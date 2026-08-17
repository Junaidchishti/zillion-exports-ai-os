import { execute, query, queryOne } from '../db/connection.js';
import { logAction } from './audit-service.js';
import { generateQRCode } from './qr-service.js';
import { broadcastToRole, sendNotification } from './notification-service.js';

export interface CreateAllocationRequestParams {
  requestType: 'MATERIAL_ISSUE' | 'CUTTING_TO_STITCHING' | 'STITCHING_TO_WASHING' | 'WASHING_TO_FINISHING' | 'FINISHING_TO_PACKING' | 'EDIT_OVERRIDE' | 'CUTTING_EXCESS_APPROVAL' | string;
  fromDept: string;
  toDept: string;
  poNumber: string;
  styleId?: number;
  colorId?: number;
  quantity: number;
  requestedBy: number;
  priority?: 'NORMAL' | 'HIGH' | 'URGENT';
  reason?: string;
  requiredDate?: string;
  payloadDetails?: any;
}

export async function createAllocationRequest(params: CreateAllocationRequestParams): Promise<any> {
  const reqNumber = `REQ-${params.fromDept.substring(0, 3)}-${params.poNumber}-${Date.now().toString().substring(7)}`;

  const res = await execute(
    `INSERT INTO allocation_requests (request_number, request_type, from_dept, to_dept, po_number, style_id, color_id, quantity, requested_by, payload_details, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    [
      reqNumber,
      params.requestType,
      params.fromDept,
      params.toDept,
      params.poNumber,
      params.styleId || null,
      params.colorId || null,
      params.quantity,
      params.requestedBy,
      params.payloadDetails ? JSON.stringify(params.payloadDetails) : JSON.stringify({ reason: params.reason, priority: params.priority, requiredDate: params.requiredDate }),
    ]
  );

  const requestId = res.lastInsertRowid;

  // Notify CEO & General Manager for approval
  await broadcastToRole(
    'CEO',
    `Pending Approval: ${params.requestType}`,
    `Request ${reqNumber} submitted by ${params.fromDept} for PO ${params.poNumber} (${params.quantity} pcs to ${params.toDept}).`
  );
  await broadcastToRole(
    'GENERAL_MANAGER',
    `Pending Approval: ${params.requestType}`,
    `Request ${reqNumber} submitted by ${params.fromDept} for PO ${params.poNumber} (${params.quantity} pcs to ${params.toDept}).`
  );

  await logAction({
    userId: params.requestedBy,
    action: 'ALLOCATION_REQUEST_CREATED',
    entityName: 'ALLOCATION_REQUEST',
    entityId: String(requestId),
    newData: { reqNumber, ...params },
    reason: params.reason || `Transfer from ${params.fromDept} to ${params.toDept}`,
  });

  return queryOne('SELECT * FROM allocation_requests WHERE id = ?', [requestId]);
}

export async function reviewAllocationRequest(
  requestId: number,
  decision: 'APPROVED' | 'REJECTED',
  reviewerUserId: number,
  reviewerRole: string,
  comments?: string
): Promise<{ request: any; qrToken?: string }> {
  if (reviewerRole !== 'CEO' && reviewerRole !== 'GENERAL_MANAGER') {
    throw new Error('Unauthorized. Only CEO or General Manager can approve or reject allocation requests.');
  }

  const req = await queryOne<any>('SELECT * FROM allocation_requests WHERE id = ?', [requestId]);
  if (!req) {
    throw new Error(`Allocation request #${requestId} not found.`);
  }

  if (req.status !== 'PENDING') {
    throw new Error(`Request #${requestId} is already ${req.status}.`);
  }

  let qrToken: string | undefined;

  if (decision === 'APPROVED') {
    await execute(
      `UPDATE allocation_requests
       SET status = 'APPROVED', approved_by = ?, approved_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reviewerUserId, requestId]
    );

    // Generate unique QR Code for this approved allocation
    const payload = {
      requestId: req.id,
      requestNumber: req.request_number,
      poNumber: req.po_number,
      fromDept: req.from_dept,
      toDept: req.to_dept,
      quantity: req.quantity,
      approvedBy: reviewerRole,
      approvedAt: new Date().toISOString(),
      details: req.payload_details ? JSON.parse(req.payload_details) : {},
    };

    qrToken = await generateQRCode('ALLOCATION', req.id, req.to_dept, req.po_number, payload);

    // Record approval in approvals table
    await execute(
      `INSERT INTO approvals (entity_type, entity_id, request_type, requested_by, approver_role, approved_by_user_id, status, comments)
       VALUES ('ALLOCATION_REQUEST', ?, ?, ?, ?, ?, 'APPROVED', ?)`,
      [requestId, req.request_type, req.requested_by, reviewerRole, reviewerUserId, comments || 'Approved']
    );

    // Notify receiving and sending departments
    await broadcastToRole(
      `${req.to_dept}_MASTER`,
      `Allocation Approved: PO ${req.po_number}`,
      `Handover of ${req.quantity} pieces from ${req.from_dept} to ${req.to_dept} approved. QR Code generated: ${qrToken}`
    );
    await sendNotification({
      recipientUserId: req.requested_by,
      title: `Request ${req.request_number} Approved`,
      message: `Your allocation of ${req.quantity} pcs for PO ${req.po_number} was approved by ${reviewerRole}. QR Code: ${qrToken}`,
      channel: 'IN_APP',
    });
  } else {
    await execute(
      `UPDATE allocation_requests
       SET status = 'REJECTED', approved_by = ?, approved_at = CURRENT_TIMESTAMP, rejection_reason = ?
       WHERE id = ?`,
      [reviewerUserId, comments || 'Rejected by management', requestId]
    );

    await execute(
      `INSERT INTO approvals (entity_type, entity_id, request_type, requested_by, approver_role, approved_by_user_id, status, comments)
       VALUES ('ALLOCATION_REQUEST', ?, ?, ?, ?, ?, 'REJECTED', ?)`,
      [requestId, req.request_type, req.requested_by, reviewerRole, reviewerUserId, comments || 'Rejected']
    );

    await sendNotification({
      recipientUserId: req.requested_by,
      title: `Request ${req.request_number} Rejected`,
      message: `Your allocation request was rejected by ${reviewerRole}. Reason: ${comments || 'No reason specified'}`,
      channel: 'IN_APP',
    });
  }

  await logAction({
    userId: reviewerUserId,
    userRole: reviewerRole,
    action: `ALLOCATION_REQUEST_${decision}`,
    entityName: 'ALLOCATION_REQUEST',
    entityId: String(requestId),
    newData: { status: decision, comments, qrToken },
    reason: comments,
  });

  const updated = await queryOne('SELECT * FROM allocation_requests WHERE id = ?', [requestId]);
  return { request: updated, qrToken };
}

export async function getPendingApprovals(): Promise<any[]> {
  return query(`
    SELECT r.*, u.full_name as requester_name, u.username as requester_username,
           s.name as style_name, c.name as color_name
    FROM allocation_requests r
    LEFT JOIN users u ON r.requested_by = u.id
    LEFT JOIN styles s ON r.style_id = s.id
    LEFT JOIN colors c ON r.color_id = c.id
    WHERE r.status = 'PENDING'
    ORDER BY r.created_at DESC
  `);
}

export async function getUserRequests(userId: number, departmentCode?: string): Promise<any[]> {
  return query(`
    SELECT r.*, u.full_name as requester_name, u.username as requester_username,
           s.name as style_name, c.name as color_name,
           (SELECT qr_data_token FROM qr_codes WHERE entity_id = r.id AND entity_type = 'ALLOCATION' LIMIT 1) as qr_token
    FROM allocation_requests r
    LEFT JOIN users u ON r.requested_by = u.id
    LEFT JOIN styles s ON r.style_id = s.id
    LEFT JOIN colors c ON r.color_id = c.id
    WHERE r.requested_by = ? OR r.from_dept = ? OR r.to_dept = ?
    ORDER BY r.created_at DESC
  `, [userId, departmentCode || '', departmentCode || '']);
}

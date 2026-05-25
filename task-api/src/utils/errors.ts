export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details: unknown[] = [],
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown[] = []) {
    super(400, 'VALIDATION_ERROR', 'Validation failed', details);
  }
}

export class InvalidCursorError extends AppError {
  constructor() {
    super(400, 'INVALID_CURSOR', 'Invalid pagination cursor');
  }
}

export class SelfDependencyError extends AppError {
  constructor() {
    super(400, 'SELF_DEPENDENCY', 'A task cannot depend on itself');
  }
}

export class CrossProjectDependencyError extends AppError {
  constructor() {
    super(400, 'CROSS_PROJECT_DEPENDENCY', 'Dependencies across projects are not allowed');
  }
}

export class SubtaskDepthExceededError extends AppError {
  constructor() {
    super(400, 'SUBTASK_DEPTH_EXCEEDED', 'Maximum subtask depth of 3 levels exceeded');
  }
}

export class UnauthenticatedError extends AppError {
  constructor() {
    super(401, 'UNAUTHENTICATED', 'Authentication required');
  }
}

export class InvalidCredentialsError extends AppError {
  constructor() {
    super(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
}

export class RefreshRequiredError extends AppError {
  constructor() {
    super(401, 'REFRESH_REQUIRED', 'Access token expired, please refresh');
  }
}

export class InvalidRefreshError extends AppError {
  constructor() {
    super(401, 'INVALID_REFRESH', 'Invalid refresh token');
  }
}

export class RefreshRevokedError extends AppError {
  constructor() {
    super(401, 'REFRESH_REVOKED', 'Refresh token has been revoked');
  }
}

export class ForbiddenError extends AppError {
  constructor() {
    super(403, 'FORBIDDEN', 'Insufficient permissions');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, 'NOT_FOUND', `${resource} not found`);
  }
}

export class ProjectNotFoundError extends AppError {
  constructor() {
    super(404, 'PROJECT_NOT_FOUND', 'Project not found');
  }
}

export class TaskNotFoundError extends AppError {
  constructor() {
    super(404, 'TASK_NOT_FOUND', 'Task not found');
  }
}

export class ParentNotFoundError extends AppError {
  constructor() {
    super(404, 'PARENT_NOT_FOUND', 'Parent task not found');
  }
}

export class EmailTakenError extends AppError {
  constructor() {
    super(409, 'EMAIL_TAKEN', 'Email address is already in use');
  }
}

export class DependencyCycleError extends AppError {
  constructor() {
    super(422, 'DEPENDENCY_CYCLE', 'Adding this dependency would create a cycle');
  }
}

export class DependencyExistsError extends AppError {
  constructor() {
    super(409, 'DEPENDENCY_EXISTS', 'Dependency already exists');
  }
}

export class MaxAssigneesExceededError extends AppError {
  constructor() {
    super(409, 'MAX_ASSIGNEES_EXCEEDED', 'Task already has the maximum number of assignees');
  }
}

export class RestoreWindowExpiredError extends AppError {
  constructor() {
    super(409, 'RESTORE_WINDOW_EXPIRED', 'Restore window has expired (30 days)');
  }
}

export class ProjectNotEmptyError extends AppError {
  constructor() {
    super(409, 'PROJECT_NOT_EMPTY', 'Project must be empty before it can be deleted');
  }
}

export class WeakPasswordError extends AppError {
  constructor() {
    super(422, 'WEAK_PASSWORD', 'Password must be at least 8 characters');
  }
}

export class InvalidStatusTransitionError extends AppError {
  constructor(from: string, to: string) {
    super(422, 'INVALID_STATUS_TRANSITION', `Cannot transition task from ${from} to ${to}`);
  }
}

export class RateLimitedError extends AppError {
  constructor(retryAfter: number) {
    super(429, 'RATE_LIMITED', 'Too many requests', [{ retryAfter }]);
  }
}

export class MemberAlreadyExistsError extends AppError {
  constructor() {
    super(409, 'MEMBER_ALREADY_EXISTS', 'User is already a member of this project');
  }
}

export class FileTooLargeError extends AppError {
  constructor(maxMb: number) {
    super(413, 'FILE_TOO_LARGE', `File exceeds the maximum allowed size of ${maxMb} MB`);
  }
}

export class InvalidFileTypeError extends AppError {
  constructor() {
    super(415, 'INVALID_FILE_TYPE', 'File type is not allowed or file content does not match its declared type');
  }
}

export class AttachmentNotFoundError extends AppError {
  constructor() {
    super(404, 'ATTACHMENT_NOT_FOUND', 'Attachment not found');
  }
}

export class TaskNotArchivableError extends AppError {
  constructor() {
    super(409, 'TASK_NOT_ARCHIVABLE', 'Only DONE or CANCELLED tasks older than 14 days can be archived');
  }
}

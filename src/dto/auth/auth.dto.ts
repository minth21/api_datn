// Login Request DTO
export interface LoginDto {
    email: string;
    password: string;
}

// Register Request DTO
export interface RegisterDto {
    email: string;
    password: string;
    name: string;
    phoneNumber?: string;
    dateOfBirth?: string; // ISO 8601 date string
    gender?: string; // MALE, FEMALE, OTHER
    role?: string; // STUDENT, STAFF, ADMIN (optional, defaults to STUDENT)
}

// User Response DTO
export interface UserDto {
    id: string;
    email: string;
    name: string;
    role: string; // STUDENT or ADMIN
    phoneNumber?: string;
    dateOfBirth?: string; // ISO 8601 date string
    gender?: string; // MALE, FEMALE, OTHER
    avatarUrl?: string;
    progress?: number; // 0-100
    targetScore?: number; // Optional target score
    hasPassword: boolean;
    createdAt: string; // ISO 8601 date string
    totalTestsTaken: number;
    averageScore: number;
}

// Login Response DTO
export interface LoginResponseDto {
    success: boolean;
    message?: string;
    user?: UserDto;
    token?: string;
}

// Generic API Response
export interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    error?: string;
}

// ============================================
// PASSWORD RESET DTOs
// ============================================

// Forgot Password Request DTO
export interface ForgotPasswordDto {
    email: string;
}

// Verify Reset Code Request DTO
export interface VerifyResetCodeDto {
    code: string;
}

// Reset Password Request DTO
export interface ResetPasswordDto {
    code: string;
    newPassword: string;
}

// Password Reset Response DTO
export interface PasswordResetResponseDto {
    success: boolean;
    message: string;
}

// Change Password Request DTO
export interface ChangePasswordDto {
    oldPassword?: string;
    newPassword: string;
}

// Login Request DTO
export interface LoginDto {
    username: string; // Mã định danh (admin, GV001, HV001)
    password: string;
}

// Register Request DTO
export interface RegisterDto {
    username: string;
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
    username: string; // Mã định danh
    name: string;
    role: string; // STUDENT, REVIEWER, SPECIALIST, ADMIN
    authProvider: string; // "LOCAL" or "GOOGLE"
    isFirstLogin?: boolean; // Bất buộc đổi mật khẩu lần đầu (trừ ADMIN)
    phoneNumber?: string;
    dateOfBirth?: string; // ISO 8601 date string
    gender?: string; // MALE, FEMALE, OTHER
    avatarUrl?: string;
    progress?: number; // 0-100
    targetScore?: number; // Optional target score
    estimatedScore?: number;
    estimatedListening?: number;
    estimatedReading?: number;
    hasPassword: boolean;
    createdAt: string; // ISO 8601 date string
    totalTestsTaken: number;
    averageScore: number;
    classId?: string;
    className?: string;
    teacherName?: string;
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
    username: string;
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

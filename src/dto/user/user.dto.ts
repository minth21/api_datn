// Update Current User Profile DTO
export interface UpdateMyProfileDto {
    name?: string;
    phoneNumber?: string;
    dateOfBirth?: string; // ISO 8601 string
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    avatarUrl?: string;
}

// Admin Update User DTO
export interface AdminUpdateUserDto {
    name?: string;
    username?: string;
    phoneNumber?: string;
    dateOfBirth?: string;
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    avatarUrl?: string;
    role?: 'STUDENT' | 'TEACHER' | 'SPECIALIST' | 'ADMIN';
    status?: 'ACTIVE' | 'LOCKED';
}

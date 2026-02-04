export const APP_CONSTANTS = {
    API_PREFIX: '/api',
    DEFAULT_PAGE_SIZE: 10,
    MAX_PAGE_SIZE: 100,
};

export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
};

export const ERROR_MESSAGES = {
    INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng',
    UNAUTHORIZED: 'Bạn cần đăng nhập để truy cập',
    TOKEN_INVALID: 'Token không hợp lệ',
    TOKEN_EXPIRED: 'Token đã hết hạn',
    USER_NOT_FOUND: 'Không tìm thấy người dùng',
    INTERNAL_ERROR: 'Lỗi hệ thống, vui lòng thử lại sau',
};

export const SUCCESS_MESSAGES = {
    LOGIN_SUCCESS: 'Đăng nhập thành công',
    LOGOUT_SUCCESS: 'Đăng xuất thành công',
};

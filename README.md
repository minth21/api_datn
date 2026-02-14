# 🎓 TOEIC-TEST Backend API

Backend API cho ứng dụng luyện thi TOEIC, được xây dựng bằng **Express.js + TypeScript**.

---

## 📂 Cấu trúc dự án

```
toeic_practice_backend/
├── src/
│   ├── config/              # ⚙️ Cấu hình
│   │   ├── env.ts           # Environment variables
│   │   └── constants.ts     # Hằng số (HTTP status, messages)
│   │
│   ├── models/              # 📊 Data Models
│   │   ├── user.model.ts    # User model + mock data
│   │   └── index.ts
│   │
│   ├── dto/                 # 📦 Data Transfer Objects
│   │   └── auth.dto.ts      # Login, User, Response DTOs
│   │
│   ├── services/            # 💼 Business Logic Layer
│   │   ├── auth.service.ts  # Logic đăng nhập, validate token
│   │   └── index.ts
│   │
│   ├── controllers/         # 🎮 Request Handlers
│   │   ├── auth.controller.ts  # Xử lý HTTP requests
│   │   └── index.ts
│   │
│   ├── routes/              # 🛣️ API Routes
│   │   ├── auth.routes.ts   # /api/auth/* routes
│   │   └── index.ts         # Tổng hợp routes
│   │
│   ├── middlewares/         # 🛡️ Middlewares
│   │   ├── auth.middleware.ts      # Xác thực token
│   │   ├── validate.middleware.ts  # Validation
│   │   └── error.middleware.ts     # Error handling
│   │
│   ├── utils/               # 🔧 Utilities
│   │   ├── response.ts      # Chuẩn hóa response
│   │   └── logger.ts        # Logging
│   │
│   ├── types/               # 📝 TypeScript Types
│   │   └── express.d.ts     # Extend Express types
│   │
│   ├── app.ts               # 🚀 Express app setup
│   └── server.ts            # 🌐 Server entry point
│
├── .env                     # Environment variables
├── .env.example             # Template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🔄 Luồng xử lý Request

```
📱 Client Request (Flutter App)
    ↓
🛣️ Routes (auth.routes.ts)
    ↓
🛡️ Middlewares (validate, auth)
    ↓
🎮 Controller (auth.controller.ts)
    ↓
💼 Service (auth.service.ts) ← Business Logic
    ↓
📊 Model (user.model.ts) ← Data Access
    ↓
💼 Service → 🎮 Controller → 📤 Response
    ↓
📱 Client Response
```

---

## 🚀 Cài đặt và Chạy

### 1. Cài đặt dependencies
```bash
npm install
```

### 2. Chạy development server
```bash
npm run dev
```

### 3. Build production
```bash
npm run build
npm start
```

Server sẽ chạy tại: **http://localhost:3000**

---

## 📡 API Endpoints

### 🔐 Authentication

#### **POST** `/api/auth/login`
Đăng nhập với email và password

**Request Body:**
```json
{
  "email": "student@toeic.com",
  "password": "123456"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "user": {
    "id": "1",
    "email": "student@toeic.com",
    "name": "Nguyễn Văn A",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "totalTestsTaken": 5,
    "averageScore": 750
  },
  "token": "mock-token-1"
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Email hoặc mật khẩu không đúng"
}
```

---

#### **GET** `/api/auth/me`
Lấy thông tin user hiện tại (cần token)

**Headers:**
```
Authorization: Bearer mock-token-1
```

**Response:**
```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "user": {
      "id": "1",
      "email": "student@toeic.com",
      "name": "Nguyễn Văn A",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "totalTestsTaken": 5,
      "averageScore": 750
    }
  }
}
```

---

#### **GET** `/api/health`
Health check endpoint

**Response:**
```json
{
  "success": true,
  "message": "TOEIC-TEST API is running",
  "timestamp": "2025-12-12T08:00:00.000Z"
}
```

---

## 🧪 Tài khoản Test

```
📧 Email: student@toeic.com
🔑 Password: 123456
```

hoặc

```
📧 Email: hocvien@test.com
🔑 Password: password
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Express.js** | Web framework |
| **TypeScript** | Type safety |
| **express-validator** | Request validation |
| **CORS** | Cross-origin support |
| **dotenv** | Environment config |

---

## 📝 Giải thích các Layer

### 1️⃣ **Models** (Data Layer)
- Định nghĩa cấu trúc dữ liệu
- Hiện tại: Mock data
- Sau này: Kết nối Database (PostgreSQL/MongoDB)

### 2️⃣ **Services** (Business Logic Layer)
- Xử lý logic nghiệp vụ
- Validate dữ liệu
- Gọi Models để truy vấn data

### 3️⃣ **Controllers** (Presentation Layer)
- Nhận HTTP request
- Gọi Service
- Trả về HTTP response
- **KHÔNG chứa business logic**

### 4️⃣ **Routes** (Routing Layer)
- Định nghĩa API endpoints
- Kết nối: Route → Middleware → Controller

### 5️⃣ **Middlewares**
- **auth.middleware**: Xác thực token
- **validate.middleware**: Validate request data
- **error.middleware**: Xử lý lỗi tập trung

### 6️⃣ **DTOs** (Data Transfer Objects)
- Định nghĩa cấu trúc data cho request/response
- Type safety với TypeScript

### 7️⃣ **Utils**
- Các hàm tiện ích tái sử dụng
- Logger, Response formatter

---

## ✅ Ưu điểm cấu trúc này

✅ **Separation of Concerns**: Mỗi layer có trách nhiệm riêng  
✅ **Dễ test**: Test từng layer độc lập  
✅ **Dễ maintain**: Thay đổi 1 layer không ảnh hưởng layer khác  
✅ **Scalable**: Dễ mở rộng khi thêm feature  
✅ **Team-friendly**: Nhiều người code cùng lúc không conflict  

---

## 🔜 Roadmap

- [ ] Kết nối Database (PostgreSQL)
- [ ] Implement JWT authentication
- [ ] Hash password với bcrypt
- [ ] Thêm User CRUD endpoints
- [ ] Thêm Test modules (Listening, Reading)
- [ ] Thêm Progress tracking
- [ ] Unit tests & Integration tests

---

## 📞 Kết nối với Flutter App

Trong Flutter app, sử dụng package `http` hoặc `dio` để gọi API:

```dart
// Example
final response = await http.post(
  Uri.parse('http://localhost:3000/api/auth/login'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({
    'email': 'student@toeic.com',
    'password': '123456',
  }),
);
```

---

## 📄 License

ISC

---

**Made with ❤️ for TOEIC learners**

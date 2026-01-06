# KITAB4U 📚

KITAB4U is a full-stack online bookstore platform built to deliver a smooth, secure, and feature-rich book shopping experience.  
The platform supports multiple payment methods, wallet refunds, coupons, product reviews, and a powerful admin dashboard with sales analytics.

---

## Features 🌟

### User Features
- Authentication & Authorization  
  - User login & registration  
  - Session-based authentication  
  - Google OAuth integration  
- Book Catalog  
  - Browse books by category  
  - Product variants (cover types, pricing)  
- Shopping Cart  
  - Add, update, and remove items  
- Wishlist  
  - Save favorite books  
- Checkout & Orders  
  - Secure checkout flow  
  - Order tracking  
  - Item-level cancellation & returns  
- Payment Options  
  - Razorpay (Online Payment)  
  - Wallet payment  
  - Cash on Delivery (COD)  
- Wallet System  
  - Refunds credited to wallet  
  - Wallet balance usage  
- Coupons & Offers  
  - Apply discount coupons  
  - Category & product-based offers  
- Product Reviews  
  - Reviews allowed only after delivery  
  - One review per product per order  
- Profile Management  
  - Address management  
  - Account details update  

---

### Admin Features
- Admin Dashboard  
  - Sales analytics & KPIs  
- User Management  
  - Block / unblock users  
- Category Management  
  - Add, edit, list & unlist categories  
- Product Management  
  - Manage books & variants  
  - Image upload using Cloudinary  
- Coupon & Offer Management  
  - Create & manage coupons  
  - Offer activation & expiry handling  
- Order Management  
  - View orders  
  - Handle cancellations & returns  
- Sales Reports  
  - Download sales reports in **PDF & Excel**  
  - Gross, net & discount calculations  

---

## Tech Stack 🔧

- Backend: Node.js, Express.js  
- Frontend: EJS, JavaScript, HTML5, CSS3, Bootstrap 5  
- Database: MongoDB with Mongoose  
- Authentication: Session-based auth, Passport.js (Google OAuth)  
- Payments: Razorpay, Wallet, COD  
- Deployment & Tools:
  - Nginx (Reverse Proxy)
  - PM2 (Process Manager)
  - AWS EC2
  - Cloudinary
  - Nodemailer

---

## Prerequisites 📋

- Node.js (v14 or above)
- MongoDB
- Git

---

## Installation & Setup 🚀

### 1. Clone the repository
```bash
git clone https://github.com/your-username/kitab4u.git
cd kitab4u

2. Install dependencies
```bash
npm install
```

3. Set up Environment Variables
Create a `.env` file in the root directory:
```env
DB_URI= you mongodb uri
SESSION_SECRET= your session secret
GOODLE_MAIL_PASS_KEY= your google mail pass key
YOUR_GOOGLE_CLIENT_ID = your google client id
YOUR_GOOGLE_CLIENT_SECRET = your google client secret
YOUR_RAZORPAY_KEY_ID = your razorpay key id
YOUR_RAZORPAY_KEY_SECRET = your razorpay key secret
```

4. Start the Application
   
Development Mode:
```bash
npm run dev
```
   
Production Mode:
```bash
npm start
```

## Project Structure 📁

kitab4u/
├── config/
├── controllers/
│   ├── user/
│   ├── admin/
│   └── reviewController.js
├── models/
│   ├── userModel.js
│   ├── productModel.js
│   ├── orderModel.js
│   ├── reviewModel.js
│   └── couponModel.js
├── routes/
│   ├── userRoutes.js
│   └── adminRoutes.js
├── middleware/
├── views/
│   ├── users/
│   ├── admin/
│   └── partials/
├── public/
│   ├── css/
│   ├── js/
│   └── images/
├── app.js
├── package.json
└── README.md

### API_Routes ## 🛣️

## Authentication
-GET /login — Load login page
-POST /login — User login
-GET /register — Registration page
-POST /register — Register new user
-GET /auth/google — Google OAuth login

## User & Shop
-GET / — Home page
-GET /shop — Browse books
-GET /productDetails?id=:id — Product details page
-POST /cart/add — Add product to cart
-POST /wishlist — Add / remove product from wishlist

## Orders & Payments
-POST /checkout — Checkout process
-POST /verifyPayment — Payment verification
-GET /myOrders — View user orders
-GET /myOrders/:id — Order details page

## Reviews
-POST /reviews/add — Add product review
-GET /reviews/:productId — Load product reviews

## Admin
-GET /admin — Admin login
-GET /admin/dashboard — Admin dashboard
-GET /admin/sales-report — Sales reports (PDF / Excel)

### Contributing 👥

Fork the repository
Create your feature branch:
git checkout -b feature/YourFeature

Commit your changes:
git commit -m "feat: add your feature"

Push to the branch:
git push origin feature/YourFeature
Open a Pull Request

### Author 👨‍💻
**Ahmed Zuhair**
**Full-Stack Developer**
**Project: KITAB4U – Online Bookstore**

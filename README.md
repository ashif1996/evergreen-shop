# 🌿 EverGreen - A Comprehensive Online Grocery Shopping Platform  

**EverGreen** is a full-stack web application built with **Node.js**, **Express**, and **MongoDB**. It allows users to browse and purchase a wide range of products, including vegetables, fruits, drinks, and nuts. The platform features robust admin controls, user-friendly interfaces, and seamless payment integration.  

## 🚀 Features  

### User Features  
- **Product Browsing**: View and filter products by category.  
- **Cart and Wishlist**: Add products to the cart or wishlist for future purchases.  
- **Order Management**: Track order history and view detailed order summaries.  
- **Secure Authentication**: Signup, login, and OTP-based password recovery.  
- **Profile Management**: Edit profile, manage addresses, and view wallet transactions.  
- **Referrals and Discounts**: Use referral codes and apply coupons for discounts.  
- **Payment Integration**: Seamless checkout with Razorpay.  

### Admin Features  
- **Dashboard**: View sales reports, order statistics, and user metrics.  
- **Product Management**: Add, edit, delete, and manage product offers.  
- **Category Management**: Create and manage product categories and offers.  
- **Coupon Management**: Add, edit, and track coupon usage.  
- **Order Management**: View, update, and manage user orders.  
- **Sales Reports**: Generate and view sales reports for specific periods.  

## 🛠️ Tech Stack  

### Backend  
- **Node.js**: JavaScript runtime.  
- **Express.js**: Web framework for handling routes and middleware.  
- **MongoDB**: Database for storing application data.  

### Frontend  
- **EJS**: Template engine for rendering dynamic HTML.  
- **CSS**: For styling the application (Bootstrap integrated).  
- **JavaScript**: For client-side interactivity.  

### Payment Integration  
- **Razorpay**: Payment gateway for secure transactions.  

## 📂 Project Structure  

```plaintext
evergreen-shop/
├── config/                   # Configuration files (DB, email, passport, etc.)
├── controllers/              # Business logic for the app
├── middlewares/              # Middleware for validation and authentication
├── models/                   # Database schemas
├── public/                   # Static files (CSS, JS, Images)
├── routes/                   # Application routing
├── utils/                    # Utility functions for various tasks
├── views/                    # EJS templates for frontend
│   ├── admin/                # Admin pages
│   ├── layouts/              # Layouts for different parts of the app
│   ├── partials/             # Reusable components like headers and footers
│   ├── users/                # User-related pages
│   ├── adminErrorMessages.ejs
│   ├── home.ejs
│   ├── internalError.ejs
│   ├── notFoundError.ejs
│   ├── searchResults.ejs
│   ├── userErrorMessages.ejs
├── .gitignore                # Git ignore file
├── app.js                    # Application entry point
├── package.json              # Project metadata and dependencies
├── package-lock.json         # Dependency lock file
└── README.md                 # Documentation
```

## 🔧 Setup and Installation  

### Prerequisites  
- **Node.js** (v16+ recommended)  
- **MongoDB** (local or cloud)  
- **npm** (Node Package Manager)  

### Steps  
1. **Clone the repository**:  
   ```bash
   git clone https://github.com/your-username/evergreen-nodejs.git
   cd evergreen-nodejs
   ```

2. **Install dependencies**:  
   ```bash
   npm install
   ```

3. **Set up environment variables**:  
   Create a `.env` file in the root directory with the following:  
   ```plaintext
   PORT=3000
   MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/evergreen
   RAZORPAY_KEY_ID=your_razorpay_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_key_secret
   EMAIL_HOST=your_email_host
   EMAIL_PORT=your_email_port
   EMAIL_USER=your_email_username
   EMAIL_PASS=your_email_password
   ```

4. **Run the application**:  
   ```bash
   npm start
   ```

5. Open your browser and go to `http://localhost:3000` to access the app.  

## 📜 Usage  

### For Users  
- Browse products, add to cart, and complete purchases securely.  
- Manage your profile, addresses, and order history.  

### For Admins  
- Log in to the admin panel to manage products, categories, orders, and users.  

## 📈 Learning Outcomes  

- Mastery of **MVC architecture** using Node.js and Express.  
- Experience with **MongoDB** for NoSQL database design.  
- Hands-on with **payment gateway integration** using Razorpay.  
- Building a **responsive user interface** with EJS templates and CSS.  

## 📜 License  

This project is licensed under the **MIT License**.

## 🌟 Acknowledgements  

- Inspired by modern e-commerce platforms.  
- Thanks to the open-source community for libraries and tools.  

Happy Coding! 🎉  
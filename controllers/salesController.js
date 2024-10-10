const Order = require("../models/orderSchema");
const moment = require("moment");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const stream = require("stream");

// Function to render the sales report page
const getSalesReportPage = async (req, res) => {
  const locals = {
    title: "Admin - Sales Report | EverGreen",
    message: {},
  };
  res.status(200).render("admin/salesReport.ejs", {
    locals,
    layout: "layouts/adminLayout.ejs",
  });
};

// Calculate report details from an array of orders
const calculateReportDetails = (orders) => {
  const totalOrders = orders.length; // Total number of orders
  const totalAmount = orders.reduce((sum, order) => sum + order.totalPrice, 0); // Sum of total prices
  const totalDiscount = orders.reduce(
    (sum, order) => sum + order.couponDiscount,
    0
  ); // Sum of discounts

  return { totalOrders, totalAmount, totalDiscount }; // Return report details
};

// Generate sales report based on order status and date range
const generateSalesReport = async (req, res) => {
  try {
    const { type, fromDate, toDate } = req.query; // Extract query parameters

    let filter = { orderStatus: "Delivered" }; // Initialize filter for delivered orders
    const today = moment(); // Get current date

    // Set date range based on report type
    if (type && type !== "custom") {
      if (type === "daily") {
        filter.orderDate = {
          $gte: today.startOf("day").toDate(), // Start of the day
          $lte: today.endOf("day").toDate(), // End of the day
        };
      } else if (type === "weekly") {
        filter.orderDate = {
          $gte: today.startOf("week").toDate(), // Start of the week
          $lte: today.endOf("week").toDate(), // End of the week
        };
      } else if (type === "monthly") {
        filter.orderDate = {
          $gte: today.startOf("month").toDate(), // Start of the month
          $lte: today.endOf("month").toDate(), // End of the month
        };
      } else if (type === "yearly") {
        filter.orderDate = {
          $gte: today.startOf("year").toDate(), // Start of the year
          $lte: today.endOf("year").toDate(), // End of the year
        };
      }
    } else if (fromDate && toDate) {
      // Custom date range filter
      filter.orderDate = { $gte: new Date(fromDate), $lte: new Date(toDate) };
    }

    // Fetch orders with populated fields
    const orders = await Order.find(filter)
      .populate({
        path: "orderItems.productId",
        select: "name", // Select only product name
      })
      .populate("userId", "firstName lastName") // Select user's first and last name
      .populate("shippingAddress") // Populate shipping address
      .lean(); // Convert to plain JavaScript objects

    const reportDetails = calculateReportDetails(orders); // Calculate report details

    res.json({ orders, reportDetails }); // Send response with orders and report details
  } catch (error) {
    console.error(error); // Log error
    res.status(500).send("Server Error"); // Send server error response
  }
};

// Generate HTML content for the sales report
const generateHTMLContent = (orders, reportDetails, fromDate, toDate) => {
  // Format date range for report
  const formattedFromDate = fromDate
    ? moment(fromDate).format("YYYY-MM-DD") // Format fromDate
    : "N/A"; // Default if no fromDate
  const formattedToDate = toDate
    ? moment(toDate).format("YYYY-MM-DD") // Format toDate
    : "N/A"; // Default if no toDate

  // Create report header
  const header = `
        <h1>EverGreen</h1>
        <p>From Date: ${formattedFromDate}</p>
        <p>To Date: ${formattedToDate}</p>
        <h2>Sales Report</h2>
        <p>Total Orders: ${reportDetails.totalOrders}</p>
        <p>Total Amount: ₹${reportDetails.totalAmount}</p>
        <p>Total Discount: ₹${reportDetails.totalDiscount}</p>
    `;

  // Define table headers
  const tableHeaders = `
        <tr>
            <th>Order ID</th>
            <th>Order Date</th>
            <th>User</th>
            <th>Products</th>
            <th>Shipping Address</th>
            <th>Payment Method</th>
            <th>Status</th>
            <th>Total Amount</th>
            <th>Coupon</th>
            <th>Coupon Discount</th>
            <th>Payable</th>
            <th>Category Discount</th>
        </tr>
    `;

  // Generate table rows from orders
  const tableRows = orders
    .map(
      (order) => `
        <tr>
            <td>${order.generatedOrderId}</td> <!-- Order ID -->
            <td>${moment(order.orderDate).format(
              "YYYY-MM-DD HH:mm:ss"
            )}</td> <!-- Formatted order date -->
            <td>${
              order.userId
                ? `${order.userId.firstName} ${order.userId.lastName}`
                : "N/A"
            }</td> <!-- User name -->
            <td>${order.orderItems
              .map(
                (item) =>
                  `${item.productId.name} - ${item.quantity} x ${item.price} = ₹${item.itemTotal}`
              )
              .join(", ")}</td> <!-- Product details -->
            <td>${
              order.shippingAddress
                ? `${order.shippingAddress.address}, ${order.shippingAddress.city}, ${order.shippingAddress.state}`
                : "N/A"
            }</td> <!-- Shipping address -->
            <td>${order.paymentMethod}</td> <!-- Payment method -->
            <td>${order.orderStatus}</td> <!-- Order status -->
            <td>₹${order.totalPrice}</td> <!-- Total amount -->
            <td>${
              order.couponId ? order.couponId.code : ""
            }</td> <!-- Coupon code -->
            <td>₹${order.couponDiscount}</td> <!-- Coupon discount -->
            <td>₹${
              order.totalPrice - order.couponDiscount
            }</td> <!-- Payable amount after discount -->
            <td>₹${order.categoryDiscount || 0}</td> <!-- Category discount -->
        </tr>
    `
    )
    .join(""); // Join rows into a single string

  // Create table with headers and rows
  const table = `<table>${tableHeaders}${tableRows}</table>`;

  // Return complete HTML document
  return `<html><head></head><body>${header}${table}</body></html>`;
};

// Function to handle the download of sales report
const downloadSalesReport = async (req, res) => {
  const { type, fromDate, toDate, format } = req.body;

  // Initialize filter for delivered orders
  let filter = { orderStatus: "Delivered" };

  // Set date range based on report type
  if (type && type !== "custom") {
    const today = moment();
    if (type === "daily") {
      filter.orderDate = {
        $gte: today.startOf("day").toDate(),
        $lte: today.endOf("day").toDate(),
      };
    } else if (type === "weekly") {
      filter.orderDate = {
        $gte: today.startOf("week").toDate(),
        $lte: today.endOf("week").toDate(),
      };
    } else if (type === "monthly") {
      filter.orderDate = {
        $gte: today.startOf("month").toDate(),
        $lte: today.endOf("month").toDate(),
      };
    } else if (type === "yearly") {
      filter.orderDate = {
        $gte: today.startOf("year").toDate(),
        $lte: today.endOf("year").toDate(),
      };
    }
  } else if (fromDate && toDate) {
    // Filter for custom date range
    filter.orderDate = { $gte: new Date(fromDate), $lte: new Date(toDate) };
  }

  // Fetch orders with populated user and product data
  const orders = await Order.find(filter)
    .populate("userId", "firstName lastName")
    .populate({ path: "orderItems.productId", select: "name" })
    .populate("shippingAddress")
    .lean();

  // Calculate report details
  const reportDetails = calculateReportDetails(orders);

  // Format dates for report
  const formattedFromDate = fromDate
    ? moment(fromDate).format("YYYY-MM-DD")
    : "N/A";
  const formattedToDate = toDate ? moment(toDate).format("YYYY-MM-DD") : "N/A";

  // Handle Excel format
  if (format === "excel") {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Report");

    // Define worksheet columns
    worksheet.columns = [
      { header: "Order ID", key: "_id", width: 30 },
      { header: "Order Date", key: "orderDate", width: 30 },
      { header: "User", key: "user", width: 30 },
      { header: "Products", key: "orderItems", width: 50 },
      { header: "Shipping Address", key: "shippingAddress", width: 50 },
      { header: "Payment Method", key: "paymentMethod", width: 20 },
      { header: "Status", key: "orderStatus", width: 20 },
      { header: "Total Amount", key: "totalPrice", width: 20 },
      { header: "Coupon", key: "coupon", width: 20 },
      { header: "Coupon Discount", key: "couponDiscount", width: 20 },
      { header: "Payable", key: "payable", width: 20 },
      { header: "Category Discount", key: "discountAmount", width: 20 },
    ];

    // Add rows to the worksheet
    orders.forEach((order) => {
      worksheet.addRow({
        _id: order.generatedOrderId,
        orderDate: moment(order.orderDate).format("YYYY-MM-DD HH:mm:ss"),
        user: order.userId
          ? `${order.userId.firstName} ${order.userId.lastName}`
          : "N/A",
        orderItems: order.orderItems
          .map(
            (item) =>
              `${item.productId.name} - ${item.quantity} x ${item.price} - ₹${item.itemTotal}`
          )
          .join("\n"),
        shippingAddress: order.shippingAddress
          ? `${order.shippingAddress.address}, ${order.shippingAddress.city}, ${order.shippingAddress.state}`
          : "N/A",
        paymentMethod: order.paymentMethod,
        orderStatus: order.orderStatus,
        totalPrice: order.totalPrice,
        coupon: order.couponId ? order.couponId.code : "",
        couponDiscount: order.couponDiscount,
        payable: order.totalPrice - order.couponDiscount,
        discountAmount: order.discountAmount || 0,
      });
    });

    // Set headers and send Excel file
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=SalesReport.xlsx"
    );
    await workbook.xlsx.write(res);
    res.end();
  }
  // Handle PDF format
  else if (format === "pdf") {
    const htmlContent = generateHTMLContent(
      orders,
      reportDetails,
      fromDate,
      toDate
    );

    const doc = new PDFDocument();
    let buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      let pdfData = Buffer.concat(buffers);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=SalesReport.pdf"
      );
      res.send(pdfData);
    });

    // Add content to the PDF
    doc.fontSize(20).text("EverGreen", { align: "center" });
    doc.fontSize(12).text(`From Date: ${formattedFromDate}`);
    doc.fontSize(12).text(`To Date: ${formattedToDate}`);
    doc.fontSize(18).text("Sales Report");
    doc.fontSize(12).text(`Total Orders: ${reportDetails.totalOrders}`);
    doc.fontSize(12).text(`Total Amount: ₹${reportDetails.totalAmount}`);
    doc.fontSize(12).text(`Total Discount: ₹${reportDetails.totalDiscount}`);
    doc.moveDown();

    // Add each order's details to the PDF
    orders.forEach((order) => {
      doc.fontSize(10).text(`Order ID: ${order.generatedOrderId}`);
      doc
        .fontSize(10)
        .text(
          `Order Date: ${moment(order.orderDate).format("YYYY-MM-DD HH:mm:ss")}`
        );
      doc
        .fontSize(10)
        .text(
          `User: ${
            order.userId
              ? `${order.userId.firstName} ${order.userId.lastName}`
              : "N/A"
          }`
        );
      doc
        .fontSize(10)
        .text(
          `Products: ${order.orderItems
            .map(
              (item) =>
                `${item.productId.name} - ${item.quantity} x ${item.price} - ₹${item.itemTotal}`
            )
            .join(", ")}`
        );
      doc
        .fontSize(10)
        .text(
          `Shipping Address: ${
            order.shippingAddress
              ? `${order.shippingAddress.address}, ${order.shippingAddress.city}, ${order.shippingAddress.state}`
              : "N/A"
          }`
        );
      doc.fontSize(10).text(`Payment Method: ${order.paymentMethod}`);
      doc.fontSize(10).text(`Status: ${order.orderStatus}`);
      doc.fontSize(10).text(`Total Amount: ₹${order.totalPrice}`);
      doc
        .fontSize(10)
        .text(`Coupon: ${order.couponId ? order.couponId.code : ""}`);
      doc.fontSize(10).text(`Coupon Discount: ₹${order.couponDiscount}`);
      doc
        .fontSize(10)
        .text(`Payable: ₹${order.totalPrice - order.couponDiscount}`);
      doc.fontSize(10).text(`Category Discount: ₹${order.discountAmount || 0}`);
      doc.moveDown();
    });

    doc.end();
  }
  // Handle invalid format
  else {
    res.status(400).send("Invalid format");
  }
};

module.exports = {
  getSalesReportPage,
  generateSalesReport,
  downloadSalesReport,
};
// Function to handle errors
const errorHandler = (res, statusCode, message) => {
  return res.status(statusCode).json({
    success: false,
    message: message,
  });
};

module.exports = {
  errorHandler,
};
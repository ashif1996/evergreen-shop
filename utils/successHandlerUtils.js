// Function to handle success
const successHandler = (res, statusCode, message) => {
    return res.status(statusCode).json({
      success: true,
      message: message,
    });
  };
  
  module.exports = successHandler;
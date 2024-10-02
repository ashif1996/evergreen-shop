const calculateSubTotal = (cart) => {
 return cart.items.reduce((acc, item) => {
    const price = item.productId.discountPrice || item.price;
    return acc + (price * item.quantity);
 }, 0);
};

const calculateCouponDiscount = (coupon, subTotal) => {
    if (!coupon) return 0;
    return coupon.type === 'PERCENTAGE' ? subTotal * (coupon.discountValue / 100) : coupon.discountValue;
};

const recalculateCartTotals = (cart) => {
    try {
        // Calculate subTotal
        cart.subTotal = calculateSubTotal(cart);

        // Calculate coupon discount
        cart.couponDiscount = calculateCouponDiscount(cart.couponId, cart.subTotal);

        // Set itemCount
        cart.itemCount = cart.items.length;

        // Debugging: Log intermediate values
        console.log('SubTotal:', cart.subTotal);
        console.log('Coupon Discount:', cart.couponDiscount);
        console.log('Shipping Charge:', cart.shippingCharge);

        // Calculate totalPrice
        cart.totalPrice = (cart.subTotal - cart.couponDiscount + cart.shippingCharge) || 0;

        // Debugging: Log totalPrice
        console.log('Calculated Total Price:', cart.totalPrice);

        // Ensure all values are numbers
        cart.subTotal = Number(cart.subTotal);
        cart.couponDiscount = Number(cart.couponDiscount);
        cart.totalPrice = Number(cart.totalPrice);
    } catch (error) {
        console.error('Error recalculating cart totals:', error);
    }
};


module.exports = {
    calculateSubTotal,
    calculateCouponDiscount,
    recalculateCartTotals
}
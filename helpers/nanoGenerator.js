const { customAlphabet } = require('nanoid');

const order = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 5);

const referral = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);

const orderID = function generateOrderId () {
    return `ORD-${order()}-${order()}`;
}

const referralCode = function generateReferralCode () {
    return `K4U-${referral()}`
}

module.exports = {
    orderID,
    referralCode
}

const Admin = require('../models/adminModel');
const User = require('../models/userModel')
const Orders = require('../models/orderModel')
const Coupon = require('../models/couponModel')

const jwt = require('jsonwebtoken');

//bcrypt password
const bcrypt = require("bcrypt");
const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        return passwordHash;
    } catch (error) {
        console.log(error.message);
    }
}

//Get login 
const loadLogin = async (req, res) => {
    try {
        res.render('login');
    } catch (error) {
        console.log(error.message);
    }
}

//verify login
const verifyAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const adminData = await Admin.findOne({ email: email });
        if (adminData) {
            const passwordMatch = await bcrypt.compare(password, adminData.password)
            if (passwordMatch) {
                const secretKey = "secret";
                const expiration = 10000;
                const adminId = adminData._id;
                const token = jwt.sign({ userId: adminId }, secretKey, { expiresIn: expiration });
                req.session.adminToken = token;
                res.redirect('/admin')
            } else {
                res.render('login', { passwordError: "Invalid Password" });
            }
        } else {

            res.render('login', { emailError: 'Invalid Email' })
        }

    } catch (error) {
        console.log(error.message);
    }
}

//Get dashboard
const loadDashboard = async (req, res) => {
    try {
        const users = await User.find()
        const blockedUser = users.filter(data=>data.access == false)
        const ordersData = await Orders.find().populate("orderDetails").populate("orderDetails.productId")
        const mergedProductIds = ordersData.flatMap(order => order.orderDetails.map(detail => detail.productId));
        const returned = ordersData.flatMap(order => order.orderDetails.filter(detail => detail.status == 'Returned'));
        const sales = ordersData.flatMap(order => order.orderDetails.filter(detail => detail.status == 'Delivered')).map(detail => detail.totalSalePrice)
        const pending = ordersData.flatMap(order => order.orderDetails.filter(detail => detail.status !== 'Delivered' && detail.status !== "Returned")).map(detail => detail.totalSalePrice)
        const total = sales.reduce((acc,cur)=>{return acc+=cur})
        const upcoming = pending.reduce((acc,cur)=>{return acc+=cur})
        res.render('dashboard', { users, orders: mergedProductIds.length, blocked : blockedUser.length, returned: returned.length, total, upcoming })
    } catch (error) {
        console.log(error.message);
    }
}

//Get logout
const adminLogout = async (req, res) => {
    try {
        delete req.session.adminToken;
        res.redirect('/admin')
    } catch (error) {
        console.log(error.message);
    }
}

//For user list show
const loadUsers = async (req, res) => {
    try {
        const userData = await User.find()
        res.render('users-list', { userData });
    } catch (error) {
        console.log(error.message);
    }
}

const userAccess = async (req, res) => {
    try {
        const id = req.query.id;
        const access = req.query.access;
        await User.updateOne({ _id: id }, { $set: { access: access } })
            .then(data => {
                res.redirect('/admin/users-list')
            })

    } catch (error) {
        console.log(error.message);
    }
}

//For show user ordered products
const ordersList = async (req, res) => {
    try {
        const ordersData = await Orders.find().populate("orderDetails.productId").populate("orderDetails.userId")
        const orderDetails = ordersData.map(order => order.orderDetails).flat();
        if (ordersData) {
            const dates = orderDetails.map(data => {
                const orderedDate = new Date(data.orderedDate);
                const newDate = new Date(orderedDate.getTime()); // create a copy of the orderedDate object
                newDate.setDate(newDate.getDate() + 7); // add 7 days to the copied date
                const orderDate = orderedDate.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
                const deliverydate = newDate.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
                return { originalDate: orderDate, newDate: deliverydate };
            });
            // orderDatas.map((data)=>console.log(data.productId.productName))
            res.render('orders-list', { orderDatas: orderDetails, name: req.session.userName, dates })
        } else {
            res.render('orders-list', { empty: "No orders" })
        }
    } catch (error) {
        console.log(error.message);
    }
}

const statusOrder = async (req, res) => {
    try {
        const { orderId, status } = req.body
        const orderStatus = await Orders.updateOne({ "orderDetails._id": orderId }, { $set: { "orderDetails.$.status": status } })
        if (orderStatus) {
            await Orders.updateOne({ "orderDetails.status": "Delivered" }, { $set: { "orderDetails.$.paymentStatus": "Paid" } })
            res.json({ success: true })
        }
    } catch (error) {
        console.log(error.message);
    }
}

//For show coupons list 
const couponList = async (req, res) => {
    try {
        const couponData = await Coupon.find()
        if (couponData) {
            res.render('coupons-list', { couponData })
        }

    } catch (error) {
        console.log(error.message);
    }
}

//Form for add coupon
const addCoupon = async (req, res) => {
    try {
        res.render('add-coupon', { existingData: '' })
    } catch (error) {
        console.log(error.message);
    }
}

//Saving coupon into mongodb
const uploadCoupon = async (req, res) => {
    try {
        const { code, type, value, minOrder, maxDiscount, status, expiryDate, quantity } = req.body
        const existingData = req.body
        if (!code.trim() || !type || isNaN(value) || !value || isNaN(minOrder) || !minOrder || !status || !expiryDate.trim()) {
            res.render('add-coupon', { error: "Check all fields properly", existingData })
        } else {
            const couponCode = await Coupon.findOne({ code: { $regex: new RegExp(code, 'i') } })
            if (couponCode) {
                const existingData = req.body
                res.render('add-coupon', { codeError: "This code already exist", existingData })
            } else {
                const coupon = new Coupon({
                    code: code,
                    type: type,
                    value: value,
                    minOrder: minOrder,
                    maxDiscount: maxDiscount,
                    status: "Active",
                    expiryDate: expiryDate,
                    quantity: quantity
                })
                const couponData = await coupon.save()
                if (couponData) {
                    res.redirect('/admin/coupons-list')
                } else {
                    res.render('add-coupon', { error: "Somethig Wrong, Try again", existingData })
                }
            }
        }
    } catch (error) {
        console.log(error.message);
    }
}

//Form for edit coupon
const loadEditCoupon = async (req, res) => {
    try {
        const couponData = await Coupon.findOne({ _id: req.query.id })
        if (couponData) {
            const existingData = req.body
            res.render('add-coupon', { existingData: couponData })
        } else {
            res.render('edit-coupon', { error: Retry })
        }
    } catch (error) {
        console.log(error.message);
    }
}

//Updating edited coupon details
const updateCoupon = async (req, res) => {
    try {
        const { code, type, value, minOrder, maxDiscount, status, expiryDate, quantity, id } = req.body
        if (!code.trim() || !type || isNaN(value) || !value || isNaN(minOrder) || !minOrder || !status || !expiryDate.trim() || !id) {
            const existingData = req.body
            res.render('edit-coupon', { error: "Check all fields properly", existingData })
        } else {
            const updatedData = await Coupon.updateOne({ _id: id }, {
                $set: {
                    code: code,
                    type: type,
                    value: value,
                    minOrder: minOrder,
                    maxDiscount: maxDiscount,
                    status: status,
                    expiryDate: expiryDate,
                    quantity: quantity
                }
            })
            if (updatedData) {
                res.redirect('/admin/coupons-list')
            } else {
                res.render('edit-coupon', { error: "Somrthig Wrong try again" })
            }
        }
    } catch (error) {
        console.log(error.message);
    }
}

//For change coupon status
const couponStatus = async (req, res) => {
    try {
        const couponId = req.query.id
        const status = req.query.status
        await Coupon.updateOne({ _id: couponId }, { $set: { status: status } })
            .then(data => {
                res.redirect('/admin/coupons-list')
            })
    } catch (error) {
        console.log(error.message)
    }
}



module.exports = {
    loadLogin,
    verifyAdmin,
    loadDashboard,
    adminLogout,

    loadUsers,
    userAccess,

    ordersList,
    statusOrder,

    couponList,
    addCoupon,
    uploadCoupon,
    loadEditCoupon,
    updateCoupon,
    couponStatus,


}
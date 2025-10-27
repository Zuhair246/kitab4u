const dotenv = require('dotenv')
dotenv.config();
const express = require('express')
const app = express()
const path = require('path')
const session=require('./middlewares/session')
const db = require('./config/db')
const userRouter = require("./routes/userRouter")
const adminRouter = require('./routes/adminRouter')
const ejs = require('ejs')
const flash = require('connect-flash')
const passport = require("./config/passport");
const nocache = require('nocache')

db()

app.use(express.json())
app.use(express.urlencoded({extended:true}))

app.use(nocache())

session(app)

app.use(passport.initialize());
app.use(passport.session())

app.use(flash())

app.set('view engine', 'ejs');
app.set("views", [path.join(__dirname,'views/user'), path.join(__dirname,"views/admin")])
app.use(express.static(path.join(__dirname,"public")))

app.use('/', userRouter)
app.use('/admin', adminRouter)

app.listen(process.env.PORT, ()=>{
    console.log("Server Running");
    
})

module.exports = app;

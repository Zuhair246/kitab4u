import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
const app = express();

import path from 'path';
import session from './middlewares/session.js';
import db from './config/db.js'
import userRouter from './routes/userRouter.js';
import adminRouter from './routes/adminRouter.js';
import ejs from 'ejs';
import flash from 'connect-flash';
import passport  from './config/passport.js';
import nocache  from 'nocache';
import { pageNotFound } from './middlewares/404middleware.js';
import { serverError } from './middlewares/500errorHandling.js';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

db();

app.use(express.json());
app.use(express.urlencoded({ extended:true }));

app.use(nocache());

session(app);

app.use(passport.initialize());
app.use(passport.session());

app.use(flash())

app.set('view engine', 'ejs');
app.set("views", [
    path.join(__dirname,'views/user'), 
    path.join(__dirname,"views/admin")
]);
app.use(express.static(path.join(__dirname,"public")));

app.use('/', userRouter);
app.use('/admin', adminRouter);

app.use(pageNotFound);
app.use(serverError);

app.listen(process.env.PORT, ()=>{
    console.log("Server Running");
    
})

// export default app;

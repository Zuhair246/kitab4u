import session from 'express-session';
import MongoStore from 'connect-mongo';
import dotenv from 'dotenv';
dotenv.config();

const commonCookieOptions = {
  maxAge: 1000 * 60 * 60 * 24, // 1 day
  httpOnly: true,
  secure: false,
  sameSite: 'lax',     
};

const adminSession = session({
  name: 'admin.sid',
  secret: process.env.ADMIN_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'adminSessions'
  }),
  cookie: commonCookieOptions
});

const userSession = session({
  name: 'user.sid',
  secret: process.env.USER_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'userSessions'
  }),
  cookie: commonCookieOptions
});


export default function sessionConfig(app) {
  app.set('trust proxy', 1);

  app.use('/admin', adminSession);
  app.use(userSession);
}

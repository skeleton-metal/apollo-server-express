import dotenv from 'dotenv'
dotenv.config()
import mongoose from 'mongoose'

mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGO_URI, {useNewUrlParser: true})

const { ObjectId } = mongoose.Types;
ObjectId.prototype.valueOf = function () {
    return this.toString();
};

import {initSecurity} from "./modules/security/services/UserInitService";
import {initCustomization} from "./modules/customization/services/CustomizationInitService";

initSecurity()
initCustomization()

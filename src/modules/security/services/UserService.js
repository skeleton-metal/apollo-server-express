import {User} from '../models/UserModel'
import bcryptjs from 'bcryptjs'
import UserEmailManager from './UserEmailManager'
import {findRoleByName} from "./RoleService";
import {UserInputError} from 'apollo-server-express'
import path from 'path'
import fs from 'fs'
import jsonwebtoken from 'jsonwebtoken'
import {createSession} from "./SessionService";
import {createLoginFail} from "./LoginFailService";

export const auth = async function ({username, password}, req) {
    return new Promise((resolve, reject) => {
        findUserByUsername(username).then(user => {
            if (!user) {
                reject('No user with that username/email')
            }
            if (user) {


                if (bcryptjs.compareSync(password, user.password)) {
                    //Registrar session
                    createSession(user, req).then(newSession => {

                        let token = jsonwebtoken.sign(
                            {
                                id: user.id,
                                name: user.name,
                                username: user.username,
                                email: user.email,
                                phone: user.phone,
                                role: user.role,
                                groups: user.groups,
                                avatarurl: user.avatarurl,
                                idSession: newSession.id
                            },
                            process.env.JWT_SECRET,
                            {expiresIn: process.env.JWT_LOGIN_EXPIRED_IN || '1d'}
                        )
                        resolve({token: token})
                    })
                } else {
                    createLoginFail(username,req)
                    reject('Incorrect password')
                }
            }
        })

    })

}

export const createUser = async function ({username, password, name, email, phone, role, groups, active}) {
    let salt = bcryptjs.genSaltSync(10);
    let hashPassword = bcryptjs.hashSync(password, salt);

    const newUser = new User({
        username,
        email,
        password: hashPassword,
        name,
        phone,
        active,
        role,
        groups,
        createdAt: Date.now()

    })

    return new Promise((resolve, rejects) => {
        newUser.save((error, doc) => {
            if (error) {
                if (error.name == "ValidationError") {
                    rejects(new UserInputError(error.message, {inputErrors: error.errors}));
                }
                rejects(error)
            } else {
                doc.populate('role').execPopulate(() => (resolve(doc))
                )
            }
        })
    })
}


export const updateUser = async function (id, {username, name, email, phone, role, groups, active}) {
    let updatedAt = Date.now()

    return new Promise((resolve, rejects) => {
        User.findOneAndUpdate(
            {_id: id}, {username, name, email, phone, role, groups, active, updatedAt}, {
                new: true,
                runValidators: true,
                context: 'query'
            },
            (error, doc) => {
                if (error) {
                    if (error.name == "ValidationError") {
                        rejects(new UserInputError(error.message, {inputErrors: error.errors}));
                    }
                    rejects(error)
                } else {
                    doc.populate('role').execPopulate(() => resolve(doc))
                }
            }
        );
    })
}

export const deleteUser = function (id) {
    return new Promise((resolve, rejects) => {

        findUser(id).then((doc) => {
            doc.softdelete(function (err) {
                err ? rejects(err) : resolve({id: id, deleteSuccess: true})
            });
        })

    })
}

export const registerUser = async function ({username, password, name, email, phone}) {

    const ROLE_NAME = "user";
    let roleObject = await findRoleByName(ROLE_NAME)

    return new Promise((resolve, rejects) => {

        let salt = bcryptjs.genSaltSync(10);
        let hash = bcryptjs.hashSync(password, salt);

        let active = false;


        const newUser = new User({
            username,
            email,
            password: hash,
            name,
            phone,
            active,
            role: roleObject,
            createdAt: Date.now()

        })
        newUser.id = newUser._id;

        newUser.save((error => {
            if (error) {
                if (error.name == "ValidationError") {
                    rejects(new UserInputError(error.message, {inputErrors: error.errors}));
                }
                rejects(error)
            } else {
                let token = jsonwebtoken.sign(
                    {
                        id: newUser.id,
                        username: newUser.username,
                        role: {name: roleObject.name},
                    },
                    process.env.JWT_SECRET,
                    {expiresIn: process.env.JWT_REGISTER_EXPIRED_IN || '30d'}
                )
                let url = process.env.APP_WEB_URL + "/activation-user/" + token
                console.log(newUser)
                UserEmailManager.activation(newUser.email, url, newUser);
                resolve({status: true, id: newUser.id, email: newUser.email});
            }
        }))

    })

}

export const activationUser = function (id) {
    return new Promise((resolve, rejects) => {
        let active = true;
        User.findOneAndUpdate({_id: id}, {active}, (error, user) => {
            if (error) {
                rejects({status: false, message: "Error al activar el usuario"})
            } else
                resolve({status: true, message: "Se activo correctamente la cuenta"})
        })
    })
}

export const findUsers = function () {
    return new Promise((resolve, reject) => {
        User.find({}).isDeleted(false).populate('role').populate('groups').exec((err, res) => (
            err ? reject(err) : resolve(res)
        ));
    })
}


export const paginateUsers = function (limit, pageNumber = 1, search = null, orderBy = null, orderDesc = false) {

    function getQuery(search) {
        let qs = {}
        if (search) {
            qs = {
                $or: [
                    {name: {$regex: search, $options: 'i'}},
                    {username: {$regex: search, $options: 'i'}},
                    {email: {$regex: search, $options: 'i'}},
                    {phone: {$regex: search, $options: 'i'}}
                ]
            }
        }
        return qs
    }

    function getSort(orderBy, orderDesc) {
        if (orderBy) {
            return (orderDesc ? '-' : '') + orderBy
        } else {
            return null
        }
    }


    let query = {deleted: false, ...getQuery(search)}
    let populate = ['role','groups']
    let sort = getSort(orderBy, orderDesc)

    let params = {page: pageNumber, limit: limit, populate: populate, sort}
    console.log(params)
    return new Promise((resolve, reject) => {
        User.paginate(query, params).then(result => {
                resolve({users: result.docs, totalItems: result.totalDocs, page: result.page})
            }
        ).catch(err => reject(err))
    })
}

export const findUser = function (id) {
    return new Promise((resolve, reject) => {
        User.findOne({_id: id}).populate('role').populate('groups').exec((err, res) => (
            err ? reject(err) : resolve(res)
        ));
    })
}

export const findUserByUsername = function (name) {
    return new Promise((resolve, reject) => {
        User.findOne({username: name}).populate('role').populate('groups').exec((err, res) => (
            err ? reject(err) : resolve(res)
        ));
    })
}


export const changePassword = function (id, {password, passwordVerify}) {

    if (password == passwordVerify) {

        let salt = bcryptjs.genSaltSync(10);
        let hash = bcryptjs.hashSync(password, salt);

        return new Promise((resolve, rejects) => {
            User.findOneAndUpdate(
                {_id: id}, {password: hash}, {new: true},
                (error) => {
                    if (error) rejects({status: false, message: "Falla al intentar modificar password"})
                    else resolve({status: true, message: "Password modificada con exito"})
                }
            );
        })


    } else {
        return new Promise((resolve, rejects) => {
            resolve({status: false, message: "Las password no concuerdan"})
        })
    }
}


export const recoveryPassword = function (email) {

    return new Promise((resolve, rejects) => {
        User.findOne({email: email}).populate('role').then((user) => {
            if (user) {
                let token = jsonwebtoken.sign(
                    {
                        id: user.id,
                        username: user.username,
                        role: {name: user.role.name}
                    },
                    process.env.JWT_SECRET,
                    {expiresIn: '1d'}
                )
                let url = process.env.APP_WEB_URL + "/reset-password/" + token

                UserEmailManager.recovery(email, url, user)
                resolve({status: true, message: "Se envio un mail para recuperar tu contraseña"})
            } else rejects({status: false, message: "No se encontro el usuario"})
        }).catch((error) => {
            if (error) rejects({status: false, message: "Fallo interno del servidor "})
        })
    })
}


export const avatarUpload = async function (user, file) {

    //@TODO validate image size, extension
    const {filename, mimetype, encoding, createReadStream} = await file;


    const parseFileName = path.parse(filename);
    const finalFileName = user.username + parseFileName.ext

    const rs = createReadStream()
    const dst = path.join("media", "avatar", finalFileName)
    var wstream = fs.createWriteStream(dst);
    rs.pipe(wstream);

    const rand = randomstring(3)
    const url = process.env.APP_API_URL + "/media/avatar/" + finalFileName + "?" + rand


    return new Promise((resolve, rejects) => {
        User.findOneAndUpdate(
            {_id: user.id}, {avatar: finalFileName, avatarurl: url}, {useFindAndModify: false},
            (error) => {
                if (error) rejects({status: false, message: "Falla al intentar guardar el avatar en la DB"})
                else resolve({filename, mimetype, encoding, url})
            }
        );
    })


    return {filename, mimetype, encoding, url};
}

function randomstring(length) {
    let result = '';
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

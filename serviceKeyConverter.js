const fs = require('fs')
const jsonData = fs.readFileSync('./bookhivefirebase-firebase-adminsdk-fbsvc-f5dbe89ab6.json')

const base64String = Buffer.from(jsonData, 'utf-8').toString('base64')
console.log(base64String)
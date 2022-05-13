const { dataSchema, validationSchema } = require('./Model');
const mongoose = require('mongoose');

module.exports = class DBConnect {
  constructor(dbAddress) {
    this.address = dbAddress;
  }
  async connect() {
    try {
      console.log('[+] Opening connection to mongodb');
      await mongoose.connect(this.address);
      console.log('[+] Connected to mongodb');
    }
    catch (e) {
      console.log(
        '[-] Could not connect to database, shutting down.\nError: ' + e
      );
      process.exit(-1);
    }
  }
  async saveData(docID, data) {
    //console.log("Save", { docID, data });
    for (let obj of data) {
      let validation = validationSchema.validate(obj);
      if (validation.error) {
        console.log("Invalid changes", validation.error);
        return false;
      }
    }
    try {
      let oldChanges = await dataSchema.findOne({docID});
      if (!oldChanges) {
        let newDoc = new dataSchema({docID, changes: data});
        let res = await newDoc.save();
        return res;
      }
      oldChanges.changes.push(...data);
      let res = await oldChanges.save()
      return res;
    } catch (e) {
      console.log("Failed to update db", e);
      return false;
    }
  }
  async retrieveData(docID) {
    console.log('find', docID);
    let res = await dataSchema.find({ docID: docID});
    console.log(res);
    return res;
  }
};

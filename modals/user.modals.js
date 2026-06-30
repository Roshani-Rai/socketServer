import mongoose, { Schema, Document } from "mongoose"  // ✅ Document from mongoose



const userSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: false 
    },
    role:{
     type:String,
     default:"user",
     enum:["user","partner","admin"]
    },
    partnerStatus:{
     type:String,
     default:"pending",
     enum:["pending","approved","rejected"]
    },
     isEmailVerified: {
      type:Boolean,
      default:false
    },
    otp:{
        type:String,

    },
    rejectionReason:{
        type:String,

    },
    otpExpiresAt:{
      type:Date
    },
    partnerStep:{
        type:Number,
        min:0,
        max:8,
        default:0
    },
     mobileNumber:{
    type:String
  },

  videoKycStatus:{
    type:String,
    enum:["not_required" ,"pending" ,"in_progress" , "approved" ,"rejected"]
  },
  videoKycRejectionReason:{
    type:String
  },
 videoKycRoomId:{
    type:String
  },
  socketId:{
    type:String
  },
  location:{
    type:{
      type:String,
      enum:["Point"]
    },
    coordinates:[Number]
  },
  isOnline:{
    type:Boolean,
    default:false,
    index:true
  }
}, { timestamps: true })

userSchema.index({location:"2dsphere"})

const User =  mongoose.model('User', userSchema)
export default User

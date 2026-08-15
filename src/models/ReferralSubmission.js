const mongoose = require('mongoose');

const REFERRAL_STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'];

const referralSubmissionSchema = new mongoose.Schema(
  {
    referrerCode: { type: String, required: true, trim: true, maxlength: 64 },
    referrerName: { type: String, required: true, trim: true, maxlength: 120 },
    referrerMobile: { type: String, required: true, trim: true, maxlength: 20 },
    friendName: { type: String, required: true, trim: true, maxlength: 120 },
    friendMobile: { type: String, required: true, trim: true, maxlength: 20 },
    friendEmail: { type: String, trim: true, maxlength: 254, default: '' },
    referrerOffer: { type: Number, default: 500 },
    friendOffer: { type: Number, default: 500 },
    branch: { type: String, trim: true, maxlength: 32, default: '' },
    status: { type: String, enum: REFERRAL_STATUSES, default: 'new' },
    admin_notes: { type: String, trim: true, maxlength: 4000, default: null }
  },
  { timestamps: true }
);

referralSubmissionSchema.index({ referrerCode: 1, friendMobile: 1 });

function toPublic(doc) {
  return {
    id: doc._id.toString(),
    referrerCode: doc.referrerCode,
    referrerName: doc.referrerName,
    referrerMobile: doc.referrerMobile,
    friendName: doc.friendName,
    friendMobile: doc.friendMobile,
    friendEmail: doc.friendEmail || '',
    referrerOffer: doc.referrerOffer,
    friendOffer: doc.friendOffer,
    branch: doc.branch || '',
    status: doc.status,
    admin_notes: doc.admin_notes ?? null,
    createdAt: doc.createdAt.toISOString()
  };
}

referralSubmissionSchema.statics.toPublic = toPublic;
module.exports =
  mongoose.models.ReferralSubmission || mongoose.model('ReferralSubmission', referralSubmissionSchema);
module.exports.REFERRAL_STATUSES = REFERRAL_STATUSES;

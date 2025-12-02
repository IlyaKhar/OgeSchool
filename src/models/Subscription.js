const mongoose = require('mongoose');

/**
 * Модель подписки
 * Отдельная модель для истории подписок и платежей
 */
const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  plan: {
    type: String,
    enum: ['free', 'start', 'econom', 'premium'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'pending'],
    default: 'active'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  autoRenewal: {
    type: Boolean,
    default: false
  },
  price: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'bank_transfer', 'other', 'test', 'mock'],
    default: 'card'
  },
  transactionId: {
    type: String,
    default: null
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  cancellationReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Индексы
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ expiresAt: 1 });

// Метод для проверки активности подписки
subscriptionSchema.methods.isActive = function() {
  return this.status === 'active' && this.expiresAt > new Date();
};

const Subscription = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;


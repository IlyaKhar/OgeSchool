const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Модель пользователя
 * Поддерживает роли: student, parent, teacher, admin, methodologist
 */
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Некорректный email']
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  age: {
    type: Number,
    min: 14,
    max: 18
  },
  grade: {
    type: Number,
    enum: [9, 10, 11],
    default: 9
  },
  role: {
    type: String,
    enum: ['student', 'parent', 'teacher', 'admin', 'methodologist'],
    default: 'student'
  },
  subscription: {
    type: {
      plan: {
        type: String,
        enum: ['free', 'start', 'econom', 'premium'],
        default: 'free'
      },
      status: {
        type: String,
        enum: ['active', 'expired', 'cancelled'],
        default: 'active'
      },
      expiresAt: Date,
      autoRenewal: {
        type: Boolean,
        default: false
      }
    },
    default: {
      plan: 'free',
      status: 'active',
      autoRenewal: false
    }
  },
  progress: {
    completedTasks: {
      type: Number,
      default: 0
    },
    totalTasks: {
      type: Number,
      default: 0
    },
    subjects: {
      type: Map,
      of: {
        completed: Number,
        total: Number,
        lastActivity: Date
      },
      default: {}
    }
  },
  refreshToken: {
    type: String,
    default: null
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  bio: {
    type: String,
    trim: true,
    maxlength: 500
  },
  avatar: {
    type: String,
    trim: false  // Не обрезаем, так как base64 может содержать важные символы
  },
  chatHistory: {
    type: [{
      role: { type: String, enum: ['user', 'ai'], required: true },
      message: { type: String, required: true },
      timestamp: { type: Date, default: Date.now }
    }],
    default: []
  },
  settings: {
    type: {
      notifications: {
        email: { type: Boolean, default: true },
        studyReminders: { type: Boolean, default: true },
        achievements: { type: Boolean, default: true },
        platformNews: { type: Boolean, default: false }
      },
      appearance: {
        theme: { type: String, enum: ['auto', 'light', 'dark'], default: 'auto' },
        fontSize: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
        compactMode: { type: Boolean, default: false },
        animations: { type: Boolean, default: true }
      },
      security: {
        twoFactorAuth: { type: Boolean, default: false }
      },
      subscription: {
        autoRenewal: { type: String, enum: ['enabled', 'disabled'], default: 'enabled' }
      }
    },
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Хеширование пароля перед сохранением
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw error;
  }
});

// Метод для проверки пароля
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Метод для получения публичных данных пользователя
userSchema.methods.toPublicJSON = function() {
  // Получаем объект из документа
  const user = this.toObject({ virtuals: false, getters: true });
  
  // Удаляем чувствительные данные
  delete user.password;
  delete user.refreshToken;
  
  // КРИТИЧНО: Явно включаем avatar из исходного документа
  // Проверяем наличие avatar в исходном документе (до toObject)
  const avatarValue = this.get('avatar');
  if (avatarValue !== undefined && avatarValue !== null && avatarValue !== '') {
    user.avatar = String(avatarValue);
    console.log('toPublicJSON: avatar включен из документа, размер:', user.avatar.length);
  } else {
    // Если avatar не найден в документе, проверяем в объекте
    if (user.avatar !== undefined && user.avatar !== null && user.avatar !== '') {
      user.avatar = String(user.avatar);
      console.log('toPublicJSON: avatar включен из объекта, размер:', user.avatar.length);
    } else {
      console.log('toPublicJSON: avatar отсутствует в документе и объекте');
      // Удаляем поле, если оно пустое
      delete user.avatar;
    }
  }
  
  // Явно включаем историю чата, если она есть
  if (this.chatHistory && this.chatHistory.length > 0) {
    user.chatHistory = this.chatHistory;
  }
  
  // Преобразуем Map в объект для JSON сериализации
  if (this.progress && this.progress.subjects instanceof Map) {
    const subjectsObj = {};
    this.progress.subjects.forEach((value, key) => {
      subjectsObj[key] = {
        completed: value.completed || 0,
        total: value.total || 0,
        lastActivity: value.lastActivity
      };
    });
    user.progress.subjects = subjectsObj;
  }
  
  return user;
};

// Индексы для оптимизации (email уже уникальный, не дублируем)
userSchema.index({ role: 1 });
userSchema.index({ 'subscription.plan': 1 });

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;


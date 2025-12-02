const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { mongoose } = require('../config/database');

// Функция для ожидания подключения MongoDB
const waitForConnection = async (maxWait = 5000) => {
  if (mongoose.connection.readyState === 1) {
    return true;
  }
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    const checkConnection = () => {
      if (mongoose.connection.readyState === 1) {
        resolve(true);
      } else if (Date.now() - startTime > maxWait) {
        console.warn('MongoDB connection timeout, proceeding anyway');
        resolve(false);
      } else {
        setTimeout(checkConnection, 100);
      }
    };
    checkConnection();
  });
};

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Генерация access token
 */
const generateAccessToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Генерация refresh token
 */
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );
};

/**
 * Верификация access token
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * Верификация refresh token
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * Регистрация нового пользователя
 */
const registerUser = async (userData) => {
  try {
    // Ждем подключения MongoDB (если еще не подключена)
    await waitForConnection(3000);
    
    // Проверяем, существует ли пользователь
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new Error('Пользователь с таким email уже существует');
    }

    // Создаем пользователя
    const user = new User({
      email: userData.email,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
      phone: userData.phone,
      age: userData.age,
      grade: userData.grade || 9,
      role: userData.role || 'student'
    });

    await user.save();

    // Генерируем токены
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // Сохраняем refresh token
    user.refreshToken = refreshToken;
    await user.save();

    return {
      user: user.toPublicJSON(),
      accessToken,
      refreshToken
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Авторизация пользователя
 */
const loginUser = async (email, password) => {
  try {
    // Ждем подключения MongoDB (если еще не подключена)
    await waitForConnection(3000);
    
    // Находим пользователя
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('Неверный email или пароль');
    }

    // Проверяем пароль
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new Error('Неверный email или пароль');
    }

    // Генерируем токены
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // Сохраняем refresh token
    user.refreshToken = refreshToken;
    await user.save();

    return {
      user: user.toPublicJSON(),
      accessToken,
      refreshToken
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Обновление access token через refresh token
 */
const refreshAccessToken = async (refreshToken) => {
  try {
    // Верифицируем refresh token
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      throw new Error('Недействительный refresh token');
    }

    // Находим пользователя
    const user = await User.findById(decoded.userId);
    if (!user || user.refreshToken !== refreshToken) {
      throw new Error('Недействительный refresh token');
    }

    // Генерируем новый access token
    const accessToken = generateAccessToken(user._id, user.role);

    return { accessToken };
  } catch (error) {
    throw error;
  }
};

/**
 * Выход пользователя (удаление refresh token)
 */
const logoutUser = async (userId) => {
  try {
    await User.findByIdAndUpdate(userId, { refreshToken: null });
    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Получение пользователя по ID
 */
const getUserById = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Пользователь не найден');
    }
    
    // Проверяем avatar разными способами
    const avatarDirect = user.get('avatar');
    const avatarProperty = user.avatar;
    console.log('getUserById: avatar в базе (get):', avatarDirect ? 'есть (размер: ' + avatarDirect.length + ')' : 'нет');
    console.log('getUserById: avatar в базе (property):', avatarProperty ? 'есть (размер: ' + avatarProperty.length + ')' : 'нет');
    
    const publicUser = user.toPublicJSON();
    
    console.log('getUserById: avatar в ответе toPublicJSON:', publicUser.avatar ? 'есть (размер: ' + (publicUser.avatar?.length || 0) + ')' : 'нет');
    
    // КРИТИЧНО: Если avatar не в ответе, но есть в базе, добавляем его вручную
    if (!publicUser.avatar && (avatarDirect || avatarProperty)) {
      const avatarToAdd = avatarDirect || avatarProperty;
      console.log('ВНИМАНИЕ: avatar есть в базе, но не в ответе getUserById! Добавляем вручную. Размер:', avatarToAdd.length);
      publicUser.avatar = String(avatarToAdd);
      console.log('Avatar добавлен вручную в getUserById, проверка:', publicUser.avatar ? 'есть (размер: ' + publicUser.avatar.length + ')' : 'нет');
    }
    
    // Включаем историю чата в ответ
    if (user.chatHistory && user.chatHistory.length > 0) {
      publicUser.chatHistory = user.chatHistory;
    }
    
    return publicUser;
  } catch (error) {
    throw error;
  }
};

/**
 * Обновление профиля пользователя
 */
const updateUserProfile = async (userId, profileData) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    // Обновляем разрешенные поля
    if (profileData.firstName !== undefined) user.firstName = profileData.firstName;
    if (profileData.lastName !== undefined) user.lastName = profileData.lastName;
    if (profileData.phone !== undefined) user.phone = profileData.phone;
    if (profileData.age !== undefined) user.age = profileData.age;
    if (profileData.grade !== undefined) user.grade = profileData.grade;
    if (profileData.bio !== undefined) user.bio = profileData.bio;
    if (profileData.avatar !== undefined) {
      console.log('=== НАЧАЛО ОБНОВЛЕНИЯ AVATAR ===');
      console.log('Обновляем avatar пользователя:', userId);
      console.log('Размер данных avatar:', profileData.avatar?.length || 0);
      console.log('Первые 50 символов:', profileData.avatar?.substring(0, 50));
      console.log('Последние 50 символов:', profileData.avatar?.substring(Math.max(0, profileData.avatar.length - 50)));
      
      // КРИТИЧНО: Используем updateOne напрямую для гарантированного сохранения
      const updateResult = await User.updateOne(
        { _id: userId },
        { $set: { avatar: profileData.avatar } }
      );
      
      console.log('Результат updateOne:', updateResult);
      console.log('Modified count:', updateResult.modifiedCount);
      console.log('Matched count:', updateResult.matchedCount);
      
      // Также обновляем в объекте user для дальнейшей работы
      user.set('avatar', profileData.avatar);
      user.avatar = profileData.avatar;
      user.markModified('avatar');
      
      console.log('Avatar установлен в объекте user:', user.avatar ? 'есть (размер: ' + user.avatar.length + ')' : 'нет');
    }
    
    // Если email изменяется, проверяем уникальность
    if (profileData.email && profileData.email !== user.email) {
      const existingUser = await User.findOne({ email: profileData.email });
      if (existingUser) {
        throw new Error('Пользователь с таким email уже существует');
      }
      user.email = profileData.email;
    }

    // Сохраняем изменения с опциями (если avatar не был обновлен через updateOne)
    if (profileData.avatar === undefined) {
      try {
        await user.save({ validateBeforeSave: true });
        console.log('Пользователь сохранен успешно (без avatar)');
      } catch (saveError) {
        console.error('Ошибка при сохранении пользователя:', saveError);
        throw saveError;
      }
    } else {
      console.log('Avatar уже обновлен через updateOne, пропускаем save()');
    }
    
    // Перезагружаем пользователя из базы, чтобы убедиться, что avatar сохранен
    // Если avatar был обновлен через updateOne, ждем немного и перезагружаем
    if (profileData.avatar !== undefined) {
      // Небольшая задержка для гарантии сохранения в MongoDB
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Используем lean(false) чтобы получить полный документ Mongoose
    const savedUser = await User.findById(userId).lean(false);
    
    if (!savedUser) {
      throw new Error('Пользователь не найден после сохранения');
    }
    
    // Проверяем avatar разными способами
    const avatarDirect = savedUser.get('avatar');
    const avatarProperty = savedUser.avatar;
    const avatarToObject = savedUser.toObject().avatar;
    
    console.log('=== ПРОВЕРКА АВАТАРА ПОСЛЕ СОХРАНЕНИЯ ===');
    console.log('Avatar в базе данных (get):', avatarDirect ? 'есть (размер: ' + avatarDirect.length + ')' : 'нет');
    console.log('Avatar в базе данных (property):', avatarProperty ? 'есть (размер: ' + avatarProperty.length + ')' : 'нет');
    console.log('Avatar в базе данных (toObject):', avatarToObject ? 'есть (размер: ' + avatarToObject.length + ')' : 'нет');
    
    // Проверяем напрямую в базе через findOne с разными методами
    const directCheck = await User.findById(userId).select('avatar').lean();
    console.log('Avatar напрямую из базы (lean):', directCheck?.avatar ? 'есть (размер: ' + directCheck.avatar.length + ')' : 'нет');
    
    // Еще одна проверка - через findOne без lean
    const directCheck2 = await User.findOne({ _id: userId }).select('avatar');
    console.log('Avatar через findOne (select):', directCheck2?.avatar ? 'есть (размер: ' + directCheck2.avatar.length + ')' : 'нет');
    
    const publicUser = savedUser.toPublicJSON();
    
    console.log('=== ПРОВЕРКА АВАТАРА В ОТВЕТЕ ===');
    console.log('Avatar в ответе toPublicJSON:', publicUser.avatar ? 'есть (размер: ' + (publicUser.avatar?.length || 0) + ')' : 'нет');
    
    // КРИТИЧНО: Если avatar не в ответе, но есть в базе, добавляем его вручную
    const avatarToAdd = avatarDirect || avatarProperty || directCheck?.avatar;
    if (!publicUser.avatar && avatarToAdd) {
      console.log('ВНИМАНИЕ: avatar есть в базе, но не в ответе! Добавляем вручную. Размер:', avatarToAdd.length);
      publicUser.avatar = String(avatarToAdd);
      console.log('Avatar добавлен вручную, проверка:', publicUser.avatar ? 'есть (размер: ' + publicUser.avatar.length + ')' : 'нет');
    } else if (publicUser.avatar) {
      console.log('Avatar успешно включен в ответ, размер:', publicUser.avatar.length);
    } else {
      console.log('ОШИБКА: Avatar отсутствует и в базе, и в ответе!');
    }
    
    // Финальная проверка перед возвратом
    console.log('Финальная проверка перед возвратом:', publicUser.avatar ? 'есть (размер: ' + publicUser.avatar.length + ')' : 'нет');
    
    return publicUser;
  } catch (error) {
    throw error;
  }
};

/**
 * Изменение пароля пользователя
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    // Проверяем текущий пароль
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw new Error('Неверный текущий пароль');
    }

    // Проверяем длину нового пароля
    if (newPassword.length < 6) {
      throw new Error('Пароль должен содержать минимум 6 символов');
    }

    // Обновляем пароль (хеширование произойдет автоматически через pre-save hook)
    user.password = newPassword;
    await user.save();

    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Обновление настроек пользователя
 */
const updateUserSettings = async (userId, settings) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    // Сохраняем настройки в поле settings (если его нет в схеме, добавим)
    if (!user.settings) {
      user.settings = {};
    }

    if (settings.notifications !== undefined) {
      user.settings.notifications = settings.notifications;
    }
    if (settings.appearance !== undefined) {
      user.settings.appearance = settings.appearance;
    }
    if (settings.security !== undefined) {
      user.settings.security = settings.security;
    }
    if (settings.subscription !== undefined) {
      user.settings.subscription = settings.subscription;
    }

    await user.save();
    return user.settings || {};
  } catch (error) {
    throw error;
  }
};

/**
 * Получение настроек пользователя
 */
const getUserSettings = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Пользователь не найден');
    }
    return user.settings || {};
  } catch (error) {
    throw error;
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  getUserById,
  updateUserProfile,
  changePassword,
  updateUserSettings,
  getUserSettings
};


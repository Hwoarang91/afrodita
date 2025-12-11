const fs = require('fs');
const path = require('path');

// Пробуем разные пути для shared (локальная разработка и Docker)
const possibleSharedPaths = [
  path.resolve(__dirname, '..', 'shared'), // Локальная разработка
  path.resolve('/app', 'shared'), // Docker
  path.resolve(__dirname, 'shared'), // Если shared уже в backend
];

let sharedPath = null;
for (const possiblePath of possibleSharedPaths) {
  if (fs.existsSync(possiblePath)) {
    sharedPath = possiblePath;
    break;
  }
}

const symlinkPath = path.resolve(__dirname, 'src', 'shared');

// Проверяем, существует ли shared папка
if (!sharedPath) {
  console.error('❌ Папка shared не найдена. Проверенные пути:');
  possibleSharedPaths.forEach(p => console.error('   -', p));
  // В Docker симлинк уже создан, поэтому не критично
  if (fs.existsSync(symlinkPath)) {
    console.log('✅ Симлинк уже существует, пропускаем создание');
    process.exit(0);
  }
  process.exit(1);
}

// Проверяем, существует ли уже симлинк
if (fs.existsSync(symlinkPath)) {
  try {
    const stats = fs.lstatSync(symlinkPath);
    if (stats.isSymbolicLink()) {
      const target = fs.readlinkSync(symlinkPath);
      if (path.resolve(symlinkPath, '..', target) === sharedPath || path.resolve(target) === sharedPath) {
        console.log('✅ Симлинк уже существует:', symlinkPath, '->', target);
        process.exit(0);
      } else {
        console.log('🔄 Удаляем старый симлинк...');
        fs.unlinkSync(symlinkPath);
      }
    } else {
      console.log('⚠️  src/shared существует, но это не симлинк. Пропускаем создание.');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Ошибка при проверке симлинка:', error.message);
    process.exit(1);
  }
}

// Создаем симлинк
try {
  // В Windows нужно использовать junction для директорий или использовать mklink
  if (process.platform === 'win32') {
    // Пробуем создать симлинк через fs.symlink
    // Если не получится, выведем инструкцию
    try {
      fs.symlinkSync(sharedPath, symlinkPath, 'junction');
      console.log('✅ Симлинк создан (junction):', symlinkPath, '->', sharedPath);
    } catch (error) {
      if (error.code === 'EPERM' || error.code === 'EACCES') {
        console.log('⚠️  Не удалось создать симлинк автоматически (требуются права администратора)');
        console.log('💡 Выполните в PowerShell от имени администратора:');
        console.log(`   New-Item -ItemType Junction -Path "${symlinkPath}" -Target "${sharedPath}"`);
        console.log('   Или используйте Docker для сборки');
        process.exit(0); // Не критично, в Docker будет работать
      } else {
        throw error;
      }
    }
  } else {
    // Linux/Mac
    fs.symlinkSync(sharedPath, symlinkPath, 'dir');
    console.log('✅ Симлинк создан:', symlinkPath, '->', sharedPath);
  }
} catch (error) {
  console.error('❌ Ошибка при создании симлинка:', error.message);
  console.log('💡 В Docker симлинк создается автоматически');
  process.exit(0); // Не критично, в Docker будет работать
}


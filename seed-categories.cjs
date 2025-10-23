const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { categories } = require('./src/server/db/schema');

// Подключение к базе данных
const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString);
const db = drizzle(sql);

async function seedCategories() {
  try {
    console.log('🌱 Начинаем заполнение категорий...');

    const categoriesData = [
      {
        name: 'Недвижимость',
        slug: 'real-estate',
        description: 'Проекты недвижимости и архитектурные решения',
        icon: '🏠',
        color: '#3B82F6'
      },
      {
        name: 'Интерьеры',
        slug: 'interiors', 
        description: 'Дизайн интерьеров и декоративные решения',
        icon: '🎨',
        color: '#8B5CF6'
      },
      {
        name: 'Фасады',
        slug: 'facades',
        description: 'Фасадные решения и внешний дизайн зданий', 
        icon: '🏢',
        color: '#10B981'
      },
      {
        name: 'Мебель',
        slug: 'furniture',
        description: 'Мебельные решения и предметы интерьера',
        icon: '🪑', 
        color: '#F59E0B'
      }
    ];

    for (const category of categoriesData) {
      await db.insert(categories).values(category).onConflictDoNothing();
      console.log(`✅ Категория "${category.name}" добавлена`);
    }

    console.log('🎉 Все категории успешно добавлены!');
  } catch (error) {
    console.error('❌ Ошибка при заполнении категорий:', error);
  } finally {
    await sql.end();
  }
}

seedCategories();

-- Add attachments field to projects table on Railway
ALTER TABLE projects ADD COLUMN IF NOT EXISTS attachments json;

-- Add categories if they don't exist
INSERT INTO categories (name, slug, description, icon, color) VALUES 
('Недвижимость', 'real-estate', 'Проекты недвижимости и архитектурные решения', '', '#3B82F6'),
('Интерьеры', 'interiors', 'Дизайн интерьеров и декоративные решения', '', '#8B5CF6'),
('Фасады', 'facades', 'Фасадные решения и внешний дизайн зданий', '', '#10B981'),
('Мебель', 'furniture', 'Мебельные решения и предметы интерьера', '', '#F59E0B')
ON CONFLICT (slug) DO NOTHING;

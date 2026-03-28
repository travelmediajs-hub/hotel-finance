-- Restructure USALI chart of accounts to proper standard names
-- Level 1: Department summary (Revenue/Expense)
-- Level 2: Category groups
-- Level 3: Specific line items (used in dropdowns)

-- ========== ROOMS ==========
UPDATE usali_accounts SET name = 'Приходи стаи' WHERE code = '1000';
UPDATE usali_accounts SET name = 'Разходи стаи' WHERE code = '2000';
UPDATE usali_accounts SET name = 'Приходи от нощувки' WHERE code = '1100';
UPDATE usali_accounts SET name = 'Други приходи стаи' WHERE code = '1200';
UPDATE usali_accounts SET name = 'Персонал' WHERE code = '2100';
UPDATE usali_accounts SET name = 'Оперативни разходи' WHERE code = '2200';
-- Level 3
UPDATE usali_accounts SET name = 'Нощувки' WHERE code = '1101';
UPDATE usali_accounts SET name = 'Късно напускане / Ранно настаняване' WHERE code = '1102';
UPDATE usali_accounts SET name = 'Мини-бар' WHERE code = '1201';
UPDATE usali_accounts SET name = 'Пералня / Химическо' WHERE code = '1202';
UPDATE usali_accounts SET name = 'Заплати' WHERE code = '2101';
UPDATE usali_accounts SET name = 'Осигуровки' WHERE code = '2102';
UPDATE usali_accounts SET name = 'Консумативи стаи' WHERE code = '2201';
UPDATE usali_accounts SET name = 'Пералня' WHERE code = '2202';
UPDATE usali_accounts SET name = 'Декорация и цветя' WHERE code = '2203';

-- ========== F&B ==========
UPDATE usali_accounts SET name = 'Приходи храна и напитки' WHERE code = '3000';
UPDATE usali_accounts SET name = 'Разходи храна и напитки' WHERE code = '4000';
UPDATE usali_accounts SET name = 'Ресторант' WHERE code = '3100';
UPDATE usali_accounts SET name = 'Бар' WHERE code = '3200';
UPDATE usali_accounts SET name = 'Банкети и събития' WHERE code = '3300';
UPDATE usali_accounts SET name = 'Персонал' WHERE code = '4100';
UPDATE usali_accounts SET name = 'Себестойност' WHERE code = '4200';
UPDATE usali_accounts SET name = 'Оперативни разходи' WHERE code = '4300';
-- Level 3
UPDATE usali_accounts SET name = 'Храна' WHERE code = '3101';
UPDATE usali_accounts SET name = 'Напитки' WHERE code = '3102';
UPDATE usali_accounts SET name = 'Напитки бар' WHERE code = '3201';
UPDATE usali_accounts SET name = 'Банкети' WHERE code = '3301';
UPDATE usali_accounts SET name = 'Заплати' WHERE code = '4101';
UPDATE usali_accounts SET name = 'Осигуровки' WHERE code = '4102';
UPDATE usali_accounts SET name = 'Хранителни продукти' WHERE code = '4201';
UPDATE usali_accounts SET name = 'Напитки (себестойност)' WHERE code = '4202';
UPDATE usali_accounts SET name = 'Прибори и посуда' WHERE code = '4301';
UPDATE usali_accounts SET name = 'Декорация' WHERE code = '4302';

-- ========== SPA ==========
UPDATE usali_accounts SET name = 'Приходи спа' WHERE code = '5000';
UPDATE usali_accounts SET name = 'Разходи спа' WHERE code = '6000';
UPDATE usali_accounts SET name = 'Услуги' WHERE code = '5100';
UPDATE usali_accounts SET name = 'Персонал' WHERE code = '6100';
UPDATE usali_accounts SET name = 'Оперативни разходи' WHERE code = '6200';
-- Level 3
UPDATE usali_accounts SET name = 'Процедури' WHERE code = '5101';
UPDATE usali_accounts SET name = 'Фитнес и басейн' WHERE code = '5102';
UPDATE usali_accounts SET name = 'Заплати' WHERE code = '6101';
UPDATE usali_accounts SET name = 'Осигуровки' WHERE code = '6102';
UPDATE usali_accounts SET name = 'Козметика и препарати' WHERE code = '6201';
UPDATE usali_accounts SET name = 'Консумативи' WHERE code = '6202';

-- ========== A&G ==========
UPDATE usali_accounts SET name = 'Административни разходи' WHERE code = '7000';
UPDATE usali_accounts SET name = 'Персонал' WHERE code = '7100';
UPDATE usali_accounts SET name = 'Оперативни разходи' WHERE code = '7200';
-- Level 3
UPDATE usali_accounts SET name = 'Заплати' WHERE code = '7101';
UPDATE usali_accounts SET name = 'Осигуровки' WHERE code = '7102';
UPDATE usali_accounts SET name = 'Счетоводство' WHERE code = '7201';
UPDATE usali_accounts SET name = 'Юридически услуги' WHERE code = '7202';
UPDATE usali_accounts SET name = 'Офис консумативи' WHERE code = '7203';
UPDATE usali_accounts SET name = 'Банкови такси' WHERE code = '7204';

-- ========== SALES & MARKETING ==========
UPDATE usali_accounts SET name = 'Маркетинг и продажби' WHERE code = '7500';
UPDATE usali_accounts SET name = 'Персонал' WHERE code = '7510';
UPDATE usali_accounts SET name = 'Оперативни разходи' WHERE code = '7520';
-- Level 3
UPDATE usali_accounts SET name = 'Заплати' WHERE code = '7511';
UPDATE usali_accounts SET name = 'Реклама' WHERE code = '7521';
UPDATE usali_accounts SET name = 'Комисионни OTA' WHERE code = '7522';
UPDATE usali_accounts SET name = 'Представителни' WHERE code = '7523';

-- ========== MAINTENANCE ==========
UPDATE usali_accounts SET name = 'Поддръжка на имота' WHERE code = '8000';
UPDATE usali_accounts SET name = 'Персонал' WHERE code = '8100';
UPDATE usali_accounts SET name = 'Оперативни разходи' WHERE code = '8200';
-- Level 3
UPDATE usali_accounts SET name = 'Заплати' WHERE code = '8101';
UPDATE usali_accounts SET name = 'Ремонт сграда' WHERE code = '8201';
UPDATE usali_accounts SET name = 'Ремонт оборудване' WHERE code = '8202';
UPDATE usali_accounts SET name = 'Резервни части' WHERE code = '8203';

-- ========== UTILITIES ==========
UPDATE usali_accounts SET name = 'Комунални услуги' WHERE code = '8500';
UPDATE usali_accounts SET name = 'Електричество' WHERE code = '8510';
UPDATE usali_accounts SET name = 'Водоснабдяване' WHERE code = '8520';
UPDATE usali_accounts SET name = 'Отопление' WHERE code = '8530';
-- Level 3
UPDATE usali_accounts SET name = 'Ел. енергия' WHERE code = '8511';
UPDATE usali_accounts SET name = 'ВиК' WHERE code = '8521';
UPDATE usali_accounts SET name = 'Газ и гориво' WHERE code = '8531';

-- ========== IT ==========
UPDATE usali_accounts SET name = 'ИТ и телекомуникации' WHERE code = '8700';
UPDATE usali_accounts SET name = 'Персонал' WHERE code = '8710';
UPDATE usali_accounts SET name = 'Оперативни разходи' WHERE code = '8720';
-- Level 3
UPDATE usali_accounts SET name = 'Заплати' WHERE code = '8711';
UPDATE usali_accounts SET name = 'Софтуер и лицензи' WHERE code = '8721';
UPDATE usali_accounts SET name = 'Хардуер' WHERE code = '8722';
UPDATE usali_accounts SET name = 'Телекомуникации' WHERE code = '8723';

-- ========== FIXED CHARGES ==========
UPDATE usali_accounts SET name = 'Управленска такса' WHERE code = '9000';
UPDATE usali_accounts SET name = 'Такса управление' WHERE code = '9010';
UPDATE usali_accounts SET name = 'Такса управление' WHERE code = '9011';

UPDATE usali_accounts SET name = 'Застраховки' WHERE code = '9200';
UPDATE usali_accounts SET name = 'Имуществени' WHERE code = '9210';
UPDATE usali_accounts SET name = 'Застраховка сгради' WHERE code = '9211';
UPDATE usali_accounts SET name = 'Застраховка оборудване' WHERE code = '9212';

UPDATE usali_accounts SET name = 'Данъци и такси' WHERE code = '9400';
UPDATE usali_accounts SET name = 'Местни данъци' WHERE code = '9410';
UPDATE usali_accounts SET name = 'Данък сгради' WHERE code = '9411';
UPDATE usali_accounts SET name = 'Такса битови отпадъци' WHERE code = '9412';
UPDATE usali_accounts SET name = 'Туристически данък' WHERE code = '9413';

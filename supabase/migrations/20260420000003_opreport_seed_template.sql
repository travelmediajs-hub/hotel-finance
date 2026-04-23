-- 1) Add any usali_accounts needed by the template that may not exist yet.
-- Each new account is assigned to the appropriate department template
-- (template_id is NOT NULL in usali_accounts).
INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
SELECT v.code, v.name, 'EXPENSE', 2, NULL, t.id, v.sort_order
FROM (VALUES
  ('9501', 'Heating (pellets)',           'UTILITIES',       10),
  ('9502', 'Local tax per night',         'TAXES',           11),
  ('9503', 'Laundry',                     'ROOMS',           12),
  ('9504', 'Software',                    'IT',              13),
  ('9505', 'TV / Telephone / Internet',   'IT',              14),
  ('9506', 'Extraordinary expenses',      'OTHER_OPERATED',  15),
  ('9507', 'Overbooking expenses',        'OTHER_OPERATED',  16),
  ('9508', 'Accounting expenses',         'AG',              17),
  ('9509', 'Booking.com commission',      'SALES_MARKETING', 18),
  ('9510', 'Facebook ad',                 'SALES_MARKETING', 19),
  ('9520', 'Food and vegetables',         'FB',              20),
  ('9521', 'Soft drinks and coffee',      'FB',              21),
  ('9522', 'Hotel supplies',              'ROOMS',           22),
  ('9530', 'Electricity',                 'UTILITIES',       30),
  ('9531', 'Water',                       'UTILITIES',       31),
  ('9532', 'LPG',                         'UTILITIES',       32),
  ('9540', 'Other expenses',              'OTHER_OPERATED',  40)
) AS v(code, name, template_code, sort_order)
JOIN usali_department_templates t ON t.code = v.template_code
WHERE NOT EXISTS (
  SELECT 1 FROM usali_accounts a WHERE a.code = v.code
);

-- 2) Insert the operational P&L template rows (35 rows total).
-- Columns: row_key, label_bg, section, sort_order, row_type,
--          formula, source, vat_applicable, budgetable, display_format, indent_level
INSERT INTO opreport_rows
  (row_key, label_bg, section, sort_order, row_type, formula, source,
   vat_applicable, budgetable, display_format, indent_level)
VALUES
-- STATISTICS
('rooms_main',          'Брой стаи (основна сграда)',       'STATISTICS',  10, 'STAT',    NULL, 'property.rooms_main',                false, false, 'NUMBER',  0),
('rooms_annex',         'Брой стаи (анекс)',                'STATISTICS',  20, 'STAT',    NULL, 'property.rooms_annex',               false, false, 'NUMBER',  0),
('total_beds',          'Общ брой легла',                   'STATISTICS',  30, 'STAT',    NULL, 'property.total_beds',                false, false, 'NUMBER',  0),
('working_days',        'Работни дни',                      'STATISTICS',  40, 'STAT',    NULL, 'period.working_days',                false, false, 'NUMBER',  0),
('rooms_available',     'Налични стая-нощи',                'STATISTICS',  50, 'STAT',    NULL, 'property_statistics.rooms_available',false, false, 'NUMBER',  0),
('rooms_sold',          'Продадени стая-нощи',              'STATISTICS',  55, 'STAT',    NULL, 'property_statistics.rooms_sold',     false, false, 'NUMBER',  0),
('occupancy_rate',      'Средна заетост',                   'STATISTICS',  60, 'DERIVED', 'rooms_sold / rooms_available', NULL,         false, false, 'PERCENT', 0),
('booked_beds',         'Легло-нощувки',                    'STATISTICS',  70, 'STAT',    NULL, 'property_statistics.guests',         false, false, 'NUMBER',  0),
('avg_price_per_bed_hb','Средна цена на легло (HB)',        'STATISTICS',  80, 'DERIVED', 'accommodation_revenue / booked_beds', NULL, false, false, 'CURRENCY',0),
-- REVENUE
('accommodation_revenue','Приходи от настаняване',          'REVENUE',    110, 'REVENUE', NULL, NULL,                                  true,  true,  'CURRENCY',0),
('fb_revenue',           'Приходи от бар и ресторант',      'REVENUE',    120, 'REVENUE', NULL, NULL,                                  true,  true,  'CURRENCY',0),
('total_incomes',        'Общо приходи',                    'REVENUE',    190, 'DERIVED','accommodation_revenue + fb_revenue', NULL,    false, false, 'CURRENCY',0),
-- F&B EXPENSES
('fb_total',             'Храна и напитки (общо)',          'FB_EXPENSES',210, 'DERIVED','food_vegetables + soft_drinks_coffee + hotel_supplies', NULL, false, false, 'CURRENCY',0),
('fb_per_guest',         'F&B на гост',                     'FB_EXPENSES',215, 'DERIVED','fb_total / booked_beds', NULL,                false, false, 'CURRENCY',1),
('food_vegetables',      '1. Храна и зеленчуци',            'FB_EXPENSES',220, 'EXPENSE', NULL, NULL,                                  true,  true,  'CURRENCY',1),
('food_per_guest',       '1.1 На гост',                     'FB_EXPENSES',225, 'DERIVED','food_vegetables / booked_beds', NULL,         false, false, 'CURRENCY',2),
('soft_drinks_coffee',   '2. Безалкохолни и кафе',          'FB_EXPENSES',230, 'EXPENSE', NULL, NULL,                                  true,  true,  'CURRENCY',1),
('soft_drinks_per_guest','2.1 На гост',                     'FB_EXPENSES',235, 'DERIVED','soft_drinks_coffee / booked_beds', NULL,      false, false, 'CURRENCY',2),
('hotel_supplies',       '3. Хотелски консумативи',         'FB_EXPENSES',240, 'EXPENSE', NULL, NULL,                                  true,  true,  'CURRENCY',1),
('hotel_supplies_per_guest','3.1 На гост',                  'FB_EXPENSES',245, 'DERIVED','hotel_supplies / booked_beds', NULL,          false, false, 'CURRENCY',2),
-- STAFF
('net_salary',           'Нетни заплати',                    'STAFF',      310, 'PAYROLL', NULL, 'payroll.net_salary',                 false, true,  'CURRENCY',0),
('social_contributions', 'Осигуровки',                       'STAFF',      320, 'PAYROLL', NULL, 'payroll.contributions',              false, true,  'CURRENCY',0),
-- UTILITIES
('electricity',          'Електричество',                    'UTILITIES',  410, 'EXPENSE', NULL, NULL,                                  true,  true,  'CURRENCY',0),
('heating_pellets',      'Отопление (пелети)',               'UTILITIES',  420, 'EXPENSE', NULL, NULL,                                  true,  true,  'CURRENCY',0),
('water',                'Вода',                             'UTILITIES',  430, 'EXPENSE', NULL, NULL,                                  true,  true,  'CURRENCY',0),
('lpg',                  'LPG',                              'UTILITIES',  440, 'EXPENSE', NULL, NULL,                                  true,  true,  'CURRENCY',0),
-- OTHER EXPENSES
('other_expenses',       'Други разходи',                    'OTHER_EXPENSES',510,'EXPENSE',NULL,NULL,                                   true,  true,  'CURRENCY',0),
('local_tax_per_night',  'Туристическа такса',               'OTHER_EXPENSES',520,'EXPENSE',NULL,NULL,                                   true,  true,  'CURRENCY',0),
('laundry',              'Пране',                            'OTHER_EXPENSES',530,'EXPENSE',NULL,NULL,                                   true,  true,  'CURRENCY',0),
('software',             'Софтуер',                          'OTHER_EXPENSES',540,'EXPENSE',NULL,NULL,                                   true,  true,  'CURRENCY',0),
('tv_tel_internet',      'ТВ, Телефон, Интернет',            'OTHER_EXPENSES',550,'EXPENSE',NULL,NULL,                                   true,  true,  'CURRENCY',0),
('extraordinary',        'Извънредни разходи',               'OTHER_EXPENSES',560,'EXPENSE',NULL,NULL,                                   true,  true,  'CURRENCY',0),
('overbooking',          'Овърбукинг разходи',               'OTHER_EXPENSES',570,'EXPENSE',NULL,NULL,                                   true,  true,  'CURRENCY',0),
('accounting',           'Счетоводство',                     'OTHER_EXPENSES',580,'EXPENSE',NULL,NULL,                                   true,  true,  'CURRENCY',0),
('booking_com_commission','Booking.com комисионна',          'OTHER_EXPENSES',590,'EXPENSE',NULL,NULL,                                   true,  true,  'CURRENCY',0),
('facebook_ads',         'Facebook реклама',                 'OTHER_EXPENSES',600,'EXPENSE',NULL,NULL,                                   true,  true,  'CURRENCY',0),
-- TOTALS
('rent',                 'Наем',                             'TOTALS',     710, 'RENT',    NULL, 'property.annual_rent',                false, false, 'CURRENCY',0),
('total_expenses',       'Общо разходи',                     'TOTALS',     720, 'DERIVED',
  'fb_total + net_salary + social_contributions + electricity + heating_pellets + water + lpg + other_expenses + local_tax_per_night + laundry + software + tv_tel_internet + extraordinary + overbooking + accounting + booking_com_commission + facebook_ads + rent',
  NULL, false, false, 'CURRENCY',0),
('profit',               'Печалба',                          'TOTALS',     730, 'DERIVED','total_incomes - total_expenses', NULL,        false, false, 'CURRENCY',0),
('net_profit_margin',    'Марж на нетна печалба',            'TOTALS',     740, 'DERIVED','profit / total_incomes', NULL,                false, false, 'PERCENT', 0),
('avg_price_per_night',  'Средна цена на нощувка',           'TOTALS',     750, 'DERIVED','accommodation_revenue / rooms_sold', NULL,    false, false, 'CURRENCY',0)
ON CONFLICT (row_key) DO NOTHING;

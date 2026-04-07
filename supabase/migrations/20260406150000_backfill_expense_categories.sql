-- Backfill expenses.account_id by pattern-matching the supplier text
-- against common Bulgarian vendor names → USALI accounts.

DO $$
DECLARE
  c_salaries     uuid; c_electricity  uuid; c_water        uuid;
  c_gas_fuel     uuid; c_telecom      uuid; c_ota          uuid;
  c_accounting   uuid; c_insurance    uuid; c_taxes        uuid;
  c_repairs      uuid; c_food         uuid; c_beverages    uuid;
  c_consumables  uuid; c_bank_fees    uuid; c_marketing    uuid;
  c_software     uuid; c_decor        uuid; c_office       uuid;
  c_hardware     uuid; c_legal        uuid; c_default      uuid;
BEGIN
  SELECT id INTO c_salaries     FROM usali_accounts WHERE code='2101' LIMIT 1;
  SELECT id INTO c_electricity  FROM usali_accounts WHERE code='8511' LIMIT 1;
  SELECT id INTO c_water        FROM usali_accounts WHERE code='8521' LIMIT 1;
  SELECT id INTO c_gas_fuel     FROM usali_accounts WHERE code='8531' LIMIT 1;
  SELECT id INTO c_telecom      FROM usali_accounts WHERE code='8723' LIMIT 1;
  SELECT id INTO c_ota          FROM usali_accounts WHERE code='7522' LIMIT 1;
  SELECT id INTO c_accounting   FROM usali_accounts WHERE code='7201' LIMIT 1;
  SELECT id INTO c_insurance    FROM usali_accounts WHERE code='9211' LIMIT 1;
  SELECT id INTO c_taxes        FROM usali_accounts WHERE code='9411' LIMIT 1;
  SELECT id INTO c_repairs      FROM usali_accounts WHERE code='8201' LIMIT 1;
  SELECT id INTO c_food         FROM usali_accounts WHERE code='4201' LIMIT 1;
  SELECT id INTO c_beverages    FROM usali_accounts WHERE code='4202' LIMIT 1;
  SELECT id INTO c_consumables  FROM usali_accounts WHERE code='2201' LIMIT 1;
  SELECT id INTO c_bank_fees    FROM usali_accounts WHERE code='7204' LIMIT 1;
  SELECT id INTO c_marketing    FROM usali_accounts WHERE code='7521' LIMIT 1;
  SELECT id INTO c_software     FROM usali_accounts WHERE code='8721' LIMIT 1;
  SELECT id INTO c_decor        FROM usali_accounts WHERE code='2203' LIMIT 1;
  SELECT id INTO c_office       FROM usali_accounts WHERE code='7203' LIMIT 1;
  SELECT id INTO c_hardware     FROM usali_accounts WHERE code='8722' LIMIT 1;
  SELECT id INTO c_legal        FROM usali_accounts WHERE code='7202' LIMIT 1;
  c_default := c_office;

  -- ВАЖНО: презаписваме всички expenses (KP Money import-ът зададе еднаква
  -- account_id на всички редове, така че мапингът трябва да тръгне отначало).
  UPDATE expenses SET account_id = CASE
    -- Заплати
    WHEN supplier ILIKE '%заплат%' OR supplier ILIKE '%осигур%' OR supplier ILIKE '%НОИ%' OR supplier ILIKE '%НАП%' THEN c_salaries

    -- Електричество
    WHEN supplier ILIKE '%ЕВН%' OR supplier ILIKE '%EVN%' OR supplier ILIKE '%Електрохолд%'
      OR supplier ILIKE '%Електро%' OR supplier ILIKE '%CEZ%' OR supplier ILIKE '%ЧЕЗ%'
      OR supplier ILIKE '%енергий%' OR supplier ILIKE '%енерго%' THEN c_electricity

    -- Вода
    WHEN supplier ILIKE 'ВИК' OR supplier ILIKE '%В и К%' OR supplier ILIKE '%ВиК%'
      OR supplier ILIKE '%водоснаб%' THEN c_water

    -- Газ / Гориво
    WHEN supplier ILIKE '%газ%' OR supplier ILIKE '%Lukoil%' OR supplier ILIKE '%Лукойл%'
      OR supplier ILIKE '%OMV%' OR supplier ILIKE '%Petrol%' OR supplier ILIKE '%Шел%'
      OR supplier ILIKE '%Shell%' OR supplier ILIKE 'EKO' OR supplier ILIKE 'ЕКО'
      OR supplier ILIKE '%гориво%' OR supplier ILIKE '%дърва%' OR supplier ILIKE '%пелети%'
      OR supplier ILIKE '%нафта%' THEN c_gas_fuel

    -- Телекомуникации
    WHEN supplier ILIKE '%Виваком%' OR supplier ILIKE '%Vivacom%' OR supplier ILIKE 'А1%'
      OR supplier ILIKE 'A1%' OR supplier ILIKE '%Telenor%' OR supplier ILIKE '%Йеттел%'
      OR supplier ILIKE '%Yettel%' OR supplier ILIKE '%кабел%' OR supplier ILIKE '%телеком%' THEN c_telecom

    -- OTA / Резервации
    WHEN supplier ILIKE '%букинг%' OR supplier ILIKE '%booking%' OR supplier ILIKE '%expedia%'
      OR supplier ILIKE '%airbnb%' OR supplier ILIKE '%trivago%' OR supplier ILIKE '%hotels.com%' THEN c_ota

    -- Счетоводство
    WHEN supplier ILIKE '%счетовод%' OR supplier ILIKE '%accounting%' THEN c_accounting

    -- Юридически
    WHEN supplier ILIKE '%адвокат%' OR supplier ILIKE '%юрист%' OR supplier ILIKE '%legal%' THEN c_legal

    -- Застраховки
    WHEN supplier ILIKE '%застрахов%' OR supplier ILIKE '%ДЗИ%' OR supplier ILIKE '%Булстрад%'
      OR supplier ILIKE '%Allianz%' OR supplier ILIKE '%Лев Инс%' OR supplier ILIKE '%insurance%' THEN c_insurance

    -- Данъци / Такси
    WHEN supplier ILIKE '%данък%' OR supplier ILIKE '%такса смет%' OR supplier ILIKE '%община%'
      OR supplier ILIKE '%туристическ%' THEN c_taxes

    -- Ремонти / поддръжка / резервни части
    WHEN supplier ILIKE '%ремонт%' OR supplier ILIKE '%сервиз%' OR supplier ILIKE '%части%'
      OR supplier ILIKE '%поддръжк%' OR supplier ILIKE '%монтаж%' OR supplier ILIKE '%инсталац%'
      OR supplier ILIKE '%климат%' OR supplier ILIKE '%асансьор%' OR supplier ILIKE '%мебел%'
      OR supplier ILIKE '%дървен%' OR supplier ILIKE '%баумакс%' OR supplier ILIKE '%baumax%'
      OR supplier ILIKE '%практик%' OR supplier ILIKE '%praktiker%' OR supplier ILIKE '%строй%'
      OR supplier ILIKE '%бои %' OR supplier ILIKE '%железа%' THEN c_repairs

    -- Храни
    WHEN supplier ILIKE '%месо%' OR supplier ILIKE '%хляб%' OR supplier ILIKE '%мляко%'
      OR supplier ILIKE '%плод%' OR supplier ILIKE '%зеленч%' OR supplier ILIKE '%кухн%'
      OR supplier ILIKE '%food%' OR supplier ILIKE '%фууд%' OR supplier ILIKE '%хранителн%'
      OR supplier ILIKE '%Билла%' OR supplier ILIKE '%Billa%' OR supplier ILIKE '%Метро%'
      OR supplier ILIKE '%Кауфланд%' OR supplier ILIKE '%Kaufland%' OR supplier ILIKE '%Лидл%'
      OR supplier ILIKE '%Lidl%' OR supplier ILIKE '%дистрибуш%' OR supplier ILIKE '%риба%'
      OR supplier ILIKE '%сирене%' OR supplier ILIKE '%яйца%' OR supplier ILIKE '%захар%'
      OR supplier ILIKE '%брашно%' OR supplier ILIKE '%макарон%' OR supplier ILIKE '%интермес%' THEN c_food

    -- Напитки
    WHEN supplier ILIKE '%напитк%' OR supplier ILIKE '%вин%' OR supplier ILIKE '%бира%'
      OR supplier ILIKE '%кафе%' OR supplier ILIKE '%coca%' OR supplier ILIKE '%кока%'
      OR supplier ILIKE '%pepsi%' OR supplier ILIKE '%пепси%' OR supplier ILIKE '%алкохол%'
      OR supplier ILIKE '%дистрибуция вин%' THEN c_beverages

    -- Консумативи / препарати / почистване
    WHEN supplier ILIKE '%консум%' OR supplier ILIKE '%препарат%' OR supplier ILIKE '%почист%'
      OR supplier ILIKE '%химия%' OR supplier ILIKE '%хигиен%' OR supplier ILIKE '%clean%'
      OR supplier ILIKE '%сапун%' OR supplier ILIKE '%хартия%' OR supplier ILIKE '%салфет%'
      OR supplier ILIKE '%пране%' OR supplier ILIKE '%перал%' OR supplier ILIKE '%hotelski%'
      OR supplier ILIKE '%хотелски%' OR supplier ILIKE '%ВЕК-хотел%' THEN c_consumables

    -- Декорация / цветя
    WHEN supplier ILIKE '%цвет%' OR supplier ILIKE '%декор%' OR supplier ILIKE '%букет%' THEN c_decor

    -- Маркетинг / реклама
    WHEN supplier ILIKE '%реклам%' OR supplier ILIKE '%маркет%' OR supplier ILIKE '%facebook%'
      OR supplier ILIKE '%google%' OR supplier ILIKE '%meta%' OR supplier ILIKE '%промо%' THEN c_marketing

    -- Софтуер / Лицензи
    WHEN supplier ILIKE '%софтуер%' OR supplier ILIKE '%software%' OR supplier ILIKE '%license%'
      OR supplier ILIKE '%лиценз%' OR supplier ILIKE '%microsoft%' OR supplier ILIKE '%adobe%'
      OR supplier ILIKE '%cloud%' OR supplier ILIKE '%хостинг%' OR supplier ILIKE '%домейн%' THEN c_software

    -- Хардуер / IT техника
    WHEN supplier ILIKE '%компютр%' OR supplier ILIKE '%лаптоп%' OR supplier ILIKE '%принтер%'
      OR supplier ILIKE '%монитор%' THEN c_hardware

    -- Банкови такси
    WHEN supplier ILIKE '%банков%' OR supplier ILIKE '%bank fee%' OR supplier ILIKE '%Уникредит%такс%'
      OR supplier ILIKE '%ДСК%такс%' OR supplier ILIKE '%Пощенска%такс%' THEN c_bank_fees

    ELSE c_default
  END;

  RAISE NOTICE 'Backfilled % expenses', (SELECT COUNT(*) FROM expenses);
END $$;

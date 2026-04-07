-- Riverside import from 'Дневни отчети Riverside 25_26 ЕВРО.xlsx'
-- Run with: supabase db execute --file scripts/riverside_import.sql
BEGIN;

DO $$
DECLARE
  v_property_id uuid;
  v_dept_id uuid;
  v_cash_id uuid;
  v_user_id uuid;
  v_acc_inc uuid;
  v_inserted int;
BEGIN
  SELECT id INTO v_property_id FROM properties WHERE name ILIKE '%ривърсайд%' LIMIT 1;
  SELECT id INTO v_dept_id FROM departments WHERE property_id = v_property_id ORDER BY sort_order LIMIT 1;
  SELECT id INTO v_cash_id FROM property_cash_registers WHERE property_id = v_property_id LIMIT 1;
  SELECT id INTO v_user_id FROM user_profiles LIMIT 1;
  SELECT id INTO v_acc_inc FROM usali_accounts WHERE code = '4101' LIMIT 1;
  IF v_acc_inc IS NULL THEN SELECT id INTO v_acc_inc FROM usali_accounts ORDER BY code LIMIT 1; END IF;
  RAISE NOTICE 'Riverside property: %, dept: %, cash: %', v_property_id, v_dept_id, v_cash_id;

  CREATE TEMP TABLE stg_exp (
    issue_date date, due_date date, supplier text, inv text,
    amount_net numeric, vat_amount numeric, category text, acct text,
    paid_at date, paid_from text, status text, method text
  ) ON COMMIT DROP;

  INSERT INTO stg_exp VALUES ('2026-01-06','2026-01-06','Еделвайс Банско ООД','10000007066',10.99,2.2,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-06','2026-01-06','Перилис Трейдинг ЕООД','3000025493',29.33,5.87,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-06','2026-01-06','Неизвестен','комплимент масаж Драго знае',50.0,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-06','2026-01-06','Консулт ИНС ЕООД','1000083372',26.53,5.31,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-06','2026-01-06','ЗОРА М.М.С ООД','848023184',151.22,30.24,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-06','2026-01-06','КОНДЕВ АУТО ЕООД','2000007031',25.36,6.34,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-06','2026-01-06','Кириц ЕООД','касова бележка',17.9,0,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-06','2026-01-06','Неизвестен','каса - рецепция',50.0,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-07','2026-01-07','Неизвестен','каса лоби бар',50.0,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-07','2026-01-07','Еконт Експрес ООД','27628287180',6.82,1.36,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-07','2026-01-07','Неизвестен','поол суплиес',133.79,26.76,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-08','2026-01-08','Консулт ИНС ЕООД','10000083615',16.48,3.3,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-08','2026-01-08','Неизвестен','войнишки оод',136.01,27.2,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-08','2026-01-08','Неизвестен','ключодържатели анекс',39.38,7.88,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-08','2026-01-08','Дъга-2000 ЕООД','3000034792',32.78,6.56,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-08','2026-01-08','Дъга-2000 ЕООД','3000034771',21.3,4.26,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-08','2026-01-08','Консуматив ООД','4000025814',46.22,9.24,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-08','2026-01-08','Неизвестен','щори-мини клуб',329.24,65.97,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-08','2026-01-08','Еконт Експрес ООД','27688227211',4.56,0.91,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-09','2026-01-09','Неизвестен','ремонт шкода - без докомент',20.0,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-09','2026-01-09','Неизвестен','мс козметик',180.0,36.0,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-09','2026-01-09','Неизвестен','игри- и.г.а.груп',232.5,46.5,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-09','2026-01-09','заплати','декември - частично',18938.69,0,'SALARIES','2101',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-10','2026-01-10','Еделвайс Банско ООД','1000007079',11.03,2.21,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-12','2026-01-12','ЕКО','105532859996',15.57,3.12,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-12','2026-01-12','Консулт ИНС ЕООД','10000083700',10.72,2.15,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-12','2026-01-12','РЕВИВА ЕООД','30000006978',1.25,0.25,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2025-01-12','2025-01-12','КОНДЕВ АУТО ЕООД','900001767',8.33,1.67,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-12','2026-01-12','Консуматив ООД','4000025880',93.45,18.69,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-14','2026-01-14','Еделвайс Банско ООД','10000007090',11.32,2.26,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-14','2026-01-14','Консулт ИНС ЕООД','1000083792',16.08,3.22,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-14','2026-01-14','Неизвестен','ПАРМА - 2789',31.92,6.38,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-15','2026-01-15','Неизвестен','община банско',2.13,0.43,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-16','2026-01-16','Неизвестен','кентавар груп',46.44,9.29,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-16','2026-01-16','Консуматив ООД','40000025937',44.92,8.98,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-16','2026-01-16','Неизвестен','чавдарски',24.71,4.94,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-16','2026-01-16','Еконт Експрес ООД','2762827284',6.29,1.26,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-17','2026-01-17','техномаркет','0730147323',69.46,13.89,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-17','2026-01-17','Еделвайс Банско ООД','1000007096',7.33,1.47,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-18','2026-01-18','Неизвестен','пеев и син',85.21,17.03,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-18','2026-01-18','заплати','финално изплащане декември',5939.95,0,'SALARIES','2101',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-20','2026-01-20','Неизвестен','автомивка',63.91,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-20','2026-01-20','Неизвестен','чистачки',23.29,4.66,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-20','2026-01-20','А1 България АД',NULL,608.33,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-20','2026-01-20','Консуматив ООД','4000026015',105.26,21.05,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-20','2026-01-20','Неизвестен','френц-община',20.45,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-20','2026-01-20','Неизвестен','френц-община',20.45,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-20','2026-01-20','Неизвестен','френц-община',20.45,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-20','2026-01-20','Неизвестен','френц-община',20.45,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-21','2026-01-21','Бриф Комплект ЕООД','6971',18.53,3.71,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-22','2026-01-22','Неизвестен','взети повече пари от карта',40.0,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-23','2026-01-23','заплати','миячка на повикване / януари',421.82,0,'SALARIES','2101',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-26','2026-01-26','техномаркет','0730147877',27.27,5.45,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2025-01-26','2025-01-26','Неизвестен','магазин без фактура',24.19,0,'FOOD_KITCHEN','4201',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-27','2026-01-27','Неизвестен','интернет-анекс',61.0,12.2,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-28','2026-01-28','Консуматив ООД','40000026154',6.17,1.23,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2025-01-29','2025-01-29','Разходен ордер','Орхан регнум - Драго знае',250.0,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-29','2026-01-29','Разходен ордер','красимир тодоров -басейн',205.0,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-01-31','2026-01-31','Неизвестен','мс козметик - чехли',180.0,36.0,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-01','2026-02-01','Аванси','ануари',700.0,0,'SALARIES','2101',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-01','2026-02-01','Кириц ЕООД','20436',31.0,6.2,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-01','2026-02-01','Еделвайс Банско ООД','1000007133',11.0,2.2,'FOOD_KITCHEN','4201',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-03','2026-02-03','Неизвестен','комплимент масаж-ефи травел',60.0,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-03','2026-02-03','Неизвестен','Лъчо - Драго',800.0,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-03','2026-02-03','Консуматив ООД','4000026251',83.48,16.7,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-03','2026-02-03','Неизвестен','джи нет - анекс',61.0,12.2,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-03','2026-02-03','Евротур ЕООД','10000067564',75.39,15.08,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-03','2026-02-03','Неви 23 00Д','20000013131',26.85,5.37,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-03','2026-02-03','Консулт ИНС ЕООД','109771',184.07,36.81,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-04','2026-02-04','Неизвестен','хорека лукс еоод',45.82,9.16,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-04','2026-02-04','Неизвестен','фишев еоод',25.56,0,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-04','2026-02-04','Бриф Комплект ЕООД','6983',158.5,31.7,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-04','2026-02-04','Неизвестен','хели иновейшън еоод',71.58,14.32,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-04','2026-02-04','Спиди АД','2994011',4.26,0.85,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-04','2026-02-04','Еконт Експрес ООД','2762828627',3.7,0.74,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-04','2026-02-04','Еконт Експрес ООД','2762827626',4.66,0.93,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-06','2026-02-06','Неизвестен','авточасти',5.0,0,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-06','2026-02-06','Ауто Кинг -ЕРИ И КО ООД','части за буса , 2000000767',262.4,52.47,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-06','2026-02-06','Неизвестен','авточасти',20.97,4.19,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-06','2026-02-06','Спиди АД',NULL,2.89,0.58,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-06','2026-02-06','Неизвестен','програмиране врата анекс',30.0,6.0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-08','2026-02-08','Еделвайс Банско ООД','1000007150',7.33,1.47,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-08','2026-02-08','Неизвестен','комисионна игри , чакам фактура',336.85,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-08','2026-02-08','Неизвестен','смяна сокно билярд чакам фактура',350.0,70.0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-09','2026-02-09','Неизвестен','аптечка кухня',24.49,0,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-10','2026-02-10','Дъга-2000 ЕООД','30000034980',14.33,2.87,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-10','2026-02-10','Дъга-2000 ЕООД','3000034981',11.45,2.29,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-11','2026-02-11','Консуматив ООД','40000026450',113.63,22.73,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-11','2026-02-11','Неизвестен','обувки камериерки - чакам документ',49.0,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-13','2026-02-13','Профклийн България ЕООД','700000001707',47.4,9.48,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-13','2026-02-13','заплати','януари',22973.0,0,'SALARIES','2101',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-13','2026-02-13','Неизвестен','пътни мичка',100.0,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2025-02-16','2025-02-16','Неизвестен','вома - анекс',100.0,20.0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-16','2026-02-16','Неизвестен','възтановена сума Драго знае',125.0,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2025-02-16','2025-02-16','Еделвайс Банско ООД','1000007165',20.23,4.05,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2025-02-16','2025-02-16','Консулт ИНС ЕООД','10000085175',5.61,1.12,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-17','2026-02-17','Еделвайс Банско ООД',NULL,6.75,0,'FOOD_KITCHEN','4201',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-17','2026-02-17','Консуматив ООД','4000026560',10.94,2.19,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-17','2026-02-17','Консуматив ООД','40000026559',79.56,15.91,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-17','2026-02-17','Неизвестен','нагревател парна баня',25.56,5.12,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-18','2026-02-18','Неизвестен','парма 92',66.67,13.33,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-18','2026-02-18','Неизвестен','вома - кухня',200.0,40.0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-18','2026-02-18','заплати','финал заплати януари',5505.62,0,'SALARIES','2101',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-20','2026-02-20','Неизвестен','медина 2003 еоод',408.0,81.68,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-20','2026-02-20','Спиди АД','61015338293',4.11,0.82,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-21','2026-02-21','Неизвестен','мс козметик',180.0,36.0,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-21','2026-02-21','Неизвестен','община банско такса - анекс',122.64,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-21','2026-02-21','Консуматив ООД','4000026658',24.79,4.96,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-24','2026-02-24','А1 България АД',NULL,608.68,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-24','2026-02-24','Бриф Комплект ЕООД','7012',32.0,6.4,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-24','2026-02-24','Консуматив ООД','4000026709',48.47,9.69,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-25','2026-02-25','Неизвестен','дендом еоод',25.03,5.01,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-26','2026-02-26','Неизвестен','смяна на партида френц -ВИК',8.52,1.7,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-02-26','2026-02-26','Консуматив ООД','40000026736',123.96,24.79,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-01','2026-03-01','Неизвестен','части бус',125.0,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-01','2026-03-01','Неизвестен','течност за чистачки',6.67,1.33,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-03','2026-03-03','Консулт ИНС ЕООД','10000085722',2.34,0.47,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-03','2026-03-03','Неизвестен','гума бус',8.33,1.67,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-03','2026-03-03','Неизвестен','община банско - френц',413.23,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-03','2026-03-03','Консуматив ООД','40000026849',24.73,4.95,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-03','2026-03-03','Неизвестен','части бус',200.0,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-03','2026-03-03','Аванси',NULL,1100.0,0,'SALARIES','2101',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-04','2026-03-04','Профклийн България ЕООД','70000002178',104.43,20.88,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-04','2026-03-04','Неизвестен','такса изипеи',2.99,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-05','2026-03-05','Неизвестен','красимир тодоров подръжка басейн',205.0,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-05','2026-03-05','Неизвестен','джи нет',61.0,12.2,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-06','2026-03-06','Неизвестен','беатрис - 20000011264',33.58,6.72,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-07','2026-03-07','Неизвестен','ауто фоки еоод',23.33,4.67,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-07','2026-03-07','Неизвестен','оренда - автомивка февруари',56.24,0,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-07','2026-03-07','Неизвестен','лидъл',16.18,3.24,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-07','2026-03-07','Неизвестен','магазин без фактура',8.76,0,'FOOD_KITCHEN','4201',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-07','2026-03-07','Неизвестен','люси тур - Драго знае',80.0,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-12','2026-03-12','Неизвестен','Лъчо - Драго знае',500.0,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-12','2026-03-12','Консуматив ООД','40000026990',48.3,9.66,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-12','2026-03-12','Неизвестен','заплати февруари',11524.93,0,'SALARIES','2101',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-14','2026-03-14','Неизвестен','заплати февруари',13346.31,0,'SALARIES','2101',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-14','2026-03-14','Неизвестен','Влади мъкнене на матраци',30.0,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-15','2026-03-15','Бриф Комплект ЕООД','7027',162.5,32.5,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-16','2026-03-16','Неизвестен','разход - френц',41.29,27.24,'FUEL','8701',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-17','2026-03-17','Неизвестен','игри - чакам фактура',335.83,67.17,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-17','2026-03-17','Консулт ИНС ЕООД','10000086355',32.24,6.45,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-17','2026-03-17','Неизвестен','фуга басеийн',160.0,32.0,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-18','2026-03-18','Консулт ИНС ЕООД','10000086411',20.13,4.03,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-20','2026-03-20','Консуматив ООД','4000027062',57.19,11.44,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-20','2026-03-20','А1 България АД',NULL,608.97,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-22','2026-03-22','Еделвайс Банско ООД','1000007241',38.27,7.65,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-26','2026-03-26','Неизвестен','френ разход',30.0,6.0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-26','2026-03-26','Еконт Експрес ООД','2770064887',3.02,0.6,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-27','2026-03-27','Неизвестен','лак за врати',21.77,4.35,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-27','2026-03-27','Консуматив ООД','40000027138',46.4,9.28,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-28','2026-03-28','Ауто Кинг -ЕРИ И КО ООД','20000000887',142.22,28.44,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-28','2026-03-28','Еконт Експрес ООД','276282828344',4.11,0.82,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-29','2026-03-29','Еконт Експрес ООД','27628283346',5.45,1.09,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-30','2026-03-30','Неизвестен','пожарна защита - пожарогасители',200.0,40.0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-30','2026-03-30','Неизвестен','вома-РАЗХОД АНЕСК УТРЕ ЩЕ ИМАМ ФАКТУРАТА',250.0,50.0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-31','2026-03-31','заплати','заплата+аванс за март',2259.88,0,'SALARIES','2101',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-03-31','2026-03-31','Неизвестен','красимир тодоров подръжка басейн',205.0,0,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-04-01','2026-04-01','Неизвестен','0000050242/ ХРАНИ ПО БДС',74.77,14.95,'FOOD_KITCHEN','4201',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-04-01','2026-04-01','Консуматив ООД','4000027187',2.5,0.5,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-04-01','2026-04-01','Бриф Комплект ЕООД','7050',166.5,33.3,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-04-02','2026-04-02','Неизвестен','1902/ДРЪЖКИ ЗА ПРОЗОРЦИ ЗАЛА',22.51,4.5,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-04-02','2026-04-02','Заплати','АВАНС ЗА М. МАРТ',100.0,0,'SALARIES','2101',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-04-02','2026-04-02','Профклийн България ЕООД','7000003978',288.96,57.79,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-04-03','2026-04-03','Билла България ЕООД','3622501571',14.64,2.93,'FOOD_KITCHEN','4201',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-04-03','2026-04-03','Консуматив ООД','4000027211',13.98,2.8,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-04-03','2026-04-03','Неизвестен','0000050264 храни бдс',199.65,39.93,'FOOD_KITCHEN','4201',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-04-03','2026-04-03','Неизвестен','9943710584 кик салфетки и консумативи',11.51,2.3,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-04-03','2026-04-03','Неизвестен','000050589 МС КОЗМЕТИК- ЧЕХЛИ',187.66,37.53,'CONSUMABLES','6021',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-04-04','2026-04-04','Неизвестен','4000000335 МЕДИНА ПАНЕЛ ЗА ВАНИ',41.67,8.33,'OTHER','9999',NULL,NULL,'UNPAID','OTHER');
  INSERT INTO stg_exp VALUES ('2026-04-05','2026-04-05','Била България','3622501605- хляб',6.93,1.39,'FOOD_KITCHEN','4201',NULL,NULL,'UNPAID','OTHER');

  -- Find missing: match by (inv, issue_date) then by (supplier,issue_date,amount)
  CREATE TEMP TABLE stg_new ON COMMIT DROP AS
  SELECT s.* FROM stg_exp s
  WHERE NOT EXISTS (
    SELECT 1 FROM expenses e
    WHERE e.property_id = v_property_id
      AND e.issue_date = s.issue_date
      AND (
        (s.inv IS NOT NULL AND e.document_number = s.inv)
        OR (s.inv IS NULL AND ABS(e.amount_net - s.amount_net) < 0.01 AND COALESCE(e.supplier,'') = COALESCE(s.supplier,''))
      )
  );
  SELECT COUNT(*) INTO v_inserted FROM stg_new;
  RAISE NOTICE 'Missing expenses to insert: %', v_inserted;

  INSERT INTO expenses (
    property_id, department_id, created_by_id, supplier, document_type, document_number,
    issue_date, due_date, amount_net, vat_amount, payment_method, paid_at, paid_from_cash,
    status, account_id
  )
  SELECT v_property_id, v_dept_id, v_user_id, s.supplier,
    CASE WHEN s.inv ~ '^[0-9]' THEN 'INVOICE' ELSE 'RECEIPT' END,
    s.inv, s.issue_date, s.due_date, s.amount_net, s.vat_amount,
    s.method, s.paid_at, s.paid_from, s.status,
    COALESCE((SELECT id FROM usali_accounts WHERE code = s.acct LIMIT 1), (SELECT id FROM usali_accounts WHERE code = '8601' LIMIT 1), (SELECT id FROM usali_accounts ORDER BY code LIMIT 1))
  FROM stg_new s;

  -- Report inserted ones
  DROP TABLE IF EXISTS imported_exp; CREATE TABLE imported_exp AS
  SELECT issue_date, supplier, inv, amount_net+vat_amount AS total FROM stg_new ORDER BY issue_date;

  -- Daily revenues → income_entries (INC_CASH and INC_BANK for POS)
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-01', v_property_id, 'INC_CASH', 3852.93, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-01', v_property_id, 'INC_BANK', 2709.94, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-02', v_property_id, 'INC_CASH', 1837.11, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-02', v_property_id, 'INC_BANK', 603.06, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-03', v_property_id, 'INC_CASH', 404.73, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-03', v_property_id, 'INC_BANK', 646.02, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-04', v_property_id, 'INC_CASH', 1034.5, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-04', v_property_id, 'INC_BANK', 692.82, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-05', v_property_id, 'INC_CASH', 316.75, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-05', v_property_id, 'INC_BANK', 360.91, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-06', v_property_id, 'INC_CASH', 142.96, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-06', v_property_id, 'INC_BANK', 158.06, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-07', v_property_id, 'INC_CASH', 205.05, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-07', v_property_id, 'INC_BANK', 104.65, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-08', v_property_id, 'INC_CASH', 60.59, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-08', v_property_id, 'INC_BANK', 273.04, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-09', v_property_id, 'INC_CASH', 508.03, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-09', v_property_id, 'INC_BANK', 38.34, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-10', v_property_id, 'INC_CASH', 493.05, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-10', v_property_id, 'INC_BANK', 126.85, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-11', v_property_id, 'INC_CASH', 698.83, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-11', v_property_id, 'INC_BANK', 112.97, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-12', v_property_id, 'INC_CASH', 183.25, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-12', v_property_id, 'INC_BANK', 96.6, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-13', v_property_id, 'INC_CASH', 442.87, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-13', v_property_id, 'INC_BANK', 1701.29, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-14', v_property_id, 'INC_CASH', 231.35, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-14', v_property_id, 'INC_BANK', 189.15, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-15', v_property_id, 'INC_CASH', 363.03, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-15', v_property_id, 'INC_BANK', 352.1, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-16', v_property_id, 'INC_CASH', 357.89, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-16', v_property_id, 'INC_BANK', 543.3, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-17', v_property_id, 'INC_CASH', 2082.17, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-17', v_property_id, 'INC_BANK', 1137.35, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-18', v_property_id, 'INC_CASH', 223.84, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-18', v_property_id, 'INC_BANK', 293.54, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-19', v_property_id, 'INC_CASH', 161.47, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-19', v_property_id, 'INC_BANK', 185.63, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-20', v_property_id, 'INC_CASH', 17.92, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-20', v_property_id, 'INC_BANK', 4540.83, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-21', v_property_id, 'INC_CASH', 330.0, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-21', v_property_id, 'INC_BANK', 175.97, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-22', v_property_id, 'INC_CASH', 114.62, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-22', v_property_id, 'INC_BANK', 39.84, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-23', v_property_id, 'INC_CASH', 297.08, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-23', v_property_id, 'INC_BANK', 286.59, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-24', v_property_id, 'INC_CASH', 1878.08, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-24', v_property_id, 'INC_BANK', 179.59, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-25', v_property_id, 'INC_CASH', 118.05, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-25', v_property_id, 'INC_BANK', 1569.03, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-26', v_property_id, 'INC_CASH', 372.56, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-26', v_property_id, 'INC_BANK', 391.42, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-27', v_property_id, 'INC_CASH', 301.91, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-27', v_property_id, 'INC_BANK', 75.65, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-28', v_property_id, 'INC_CASH', 116.74, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-28', v_property_id, 'INC_BANK', 71.02, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-29', v_property_id, 'INC_CASH', 99.03, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-29', v_property_id, 'INC_BANK', 23.52, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-30', v_property_id, 'INC_CASH', 1204.44, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-30', v_property_id, 'INC_BANK', 2031.28, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-31', v_property_id, 'INC_CASH', 695.72, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-31', v_property_id, 'INC_BANK', 1523.36, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-01', v_property_id, 'INC_CASH', 1024.38, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-01', v_property_id, 'INC_BANK', 646.93, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-02', v_property_id, 'INC_CASH', 187.57, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-02', v_property_id, 'INC_BANK', 192.72, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-03', v_property_id, 'INC_CASH', 264.21, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-03', v_property_id, 'INC_BANK', 143.44, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-04', v_property_id, 'INC_CASH', 624.69, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-04', v_property_id, 'INC_BANK', 650.9, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-05', v_property_id, 'INC_CASH', 333.86, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-05', v_property_id, 'INC_BANK', 956.86, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-06', v_property_id, 'INC_CASH', 886.02, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-06', v_property_id, 'INC_BANK', 1161.43, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-07', v_property_id, 'INC_CASH', 539.22, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-07', v_property_id, 'INC_BANK', 1047.62, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-08', v_property_id, 'INC_CASH', 464.39, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-08', v_property_id, 'INC_BANK', 600.42, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-09', v_property_id, 'INC_CASH', 276.35, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-09', v_property_id, 'INC_BANK', 171.35, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-10', v_property_id, 'INC_CASH', 662.35, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-10', v_property_id, 'INC_BANK', 783.84, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-11', v_property_id, 'INC_CASH', 418.48, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-11', v_property_id, 'INC_BANK', 752.59, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-12', v_property_id, 'INC_CASH', 226.72, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-12', v_property_id, 'INC_BANK', 170.83, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-13', v_property_id, 'INC_CASH', 1720.78, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-13', v_property_id, 'INC_BANK', 272.94, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-14', v_property_id, 'INC_CASH', 1308.37, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-14', v_property_id, 'INC_BANK', 149.35, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-15', v_property_id, 'INC_CASH', 407.05, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-15', v_property_id, 'INC_BANK', 1431.89, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-16', v_property_id, 'INC_CASH', 251.96, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-16', v_property_id, 'INC_BANK', 62.54, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-17', v_property_id, 'INC_CASH', 864.7, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-17', v_property_id, 'INC_BANK', 301.2, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-18', v_property_id, 'INC_CASH', 261.87, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-18', v_property_id, 'INC_BANK', 136.81, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-19', v_property_id, 'INC_CASH', 899.48, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-19', v_property_id, 'INC_BANK', 197.89, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-20', v_property_id, 'INC_CASH', 289.65, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-20', v_property_id, 'INC_BANK', 302.91, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-21', v_property_id, 'INC_CASH', 771.02, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-21', v_property_id, 'INC_BANK', 1206.43, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-22', v_property_id, 'INC_CASH', 203.61, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-22', v_property_id, 'INC_BANK', 345.43, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-23', v_property_id, 'INC_CASH', 285.12, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-23', v_property_id, 'INC_BANK', 264.03, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-24', v_property_id, 'INC_CASH', 155.33, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-24', v_property_id, 'INC_BANK', 143.01, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-25', v_property_id, 'INC_CASH', 520.29, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-25', v_property_id, 'INC_BANK', 136.49, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-26', v_property_id, 'INC_CASH', 374.32, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-26', v_property_id, 'INC_BANK', 103.27, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-27', v_property_id, 'INC_CASH', 593.32, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-27', v_property_id, 'INC_BANK', 395.48, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-28', v_property_id, 'INC_CASH', 2488.73, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-28', v_property_id, 'INC_BANK', 3805.89, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-01', v_property_id, 'INC_CASH', 340.74, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-01', v_property_id, 'INC_BANK', 86.54, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-02', v_property_id, 'INC_CASH', 723.21, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-02', v_property_id, 'INC_BANK', 175.68, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-03', v_property_id, 'INC_CASH', 73.57, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-03', v_property_id, 'INC_BANK', 71.61, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-04', v_property_id, 'INC_CASH', 49.34, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-04', v_property_id, 'INC_BANK', 108.17, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-05', v_property_id, 'INC_CASH', 73.14, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-05', v_property_id, 'INC_BANK', 9.97, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-06', v_property_id, 'INC_CASH', 1771.42, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-06', v_property_id, 'INC_BANK', 18.93, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-07', v_property_id, 'INC_CASH', 392.84, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-07', v_property_id, 'INC_BANK', 95.59, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-08', v_property_id, 'INC_CASH', 326.92, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-08', v_property_id, 'INC_BANK', 207.15, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-09', v_property_id, 'INC_CASH', 53.68, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-09', v_property_id, 'INC_BANK', 30.44, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-10', v_property_id, 'INC_CASH', 111.83, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-10', v_property_id, 'INC_BANK', 161.66, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-11', v_property_id, 'INC_CASH', 2.56, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-11', v_property_id, 'INC_BANK', 31.73, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-12', v_property_id, 'INC_CASH', 4.86, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-12', v_property_id, 'INC_BANK', 128.64, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-13', v_property_id, 'INC_CASH', 273.74, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-13', v_property_id, 'INC_BANK', 514.97, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-14', v_property_id, 'INC_CASH', 1017.24, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-14', v_property_id, 'INC_BANK', 1379.53, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-15', v_property_id, 'INC_CASH', 340.35, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-15', v_property_id, 'INC_BANK', 130.29, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-16', v_property_id, 'INC_CASH', 136.84, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-16', v_property_id, 'INC_BANK', 31.67, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-17', v_property_id, 'INC_CASH', 65.83, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-17', v_property_id, 'INC_BANK', 50.0, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-18', v_property_id, 'INC_CASH', 80.34, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-18', v_property_id, 'INC_BANK', 1.53, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-19', v_property_id, 'INC_CASH', 66.3, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-19', v_property_id, 'INC_BANK', 30.95, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-20', v_property_id, 'INC_CASH', 485.41, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-20', v_property_id, 'INC_BANK', 650.59, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-21', v_property_id, 'INC_CASH', 381.9, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-21', v_property_id, 'INC_BANK', 190.0, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-22', v_property_id, 'INC_CASH', 459.24, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-22', v_property_id, 'INC_BANK', 10.23, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-23', v_property_id, 'INC_CASH', 52.7, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-24', v_property_id, 'INC_CASH', 17.91, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-24', v_property_id, 'INC_BANK', 35.8, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-25', v_property_id, 'INC_CASH', 50.0, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-26', v_property_id, 'INC_CASH', 222.29, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-26', v_property_id, 'INC_BANK', 53.48, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-27', v_property_id, 'INC_CASH', 1434.91, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-27', v_property_id, 'INC_BANK', 183.63, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-28', v_property_id, 'INC_CASH', 356.05, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-28', v_property_id, 'INC_BANK', 220.38, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-29', v_property_id, 'INC_CASH', 7.68, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-29', v_property_id, 'INC_BANK', 107.79, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-30', v_property_id, 'INC_CASH', 25.31, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-31', v_property_id, 'INC_CASH', 62.15, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-31', v_property_id, 'INC_BANK', 83.75, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-04-01', v_property_id, 'INC_CASH', 144.51, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-04-02', v_property_id, 'INC_CASH', 148.54, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-04-02', v_property_id, 'INC_BANK', 249.12, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-04-03', v_property_id, 'INC_CASH', 381.76, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-04-03', v_property_id, 'INC_BANK', 442.27, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-04-04', v_property_id, 'INC_CASH', 483.89, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-04-04', v_property_id, 'INC_BANK', 547.95, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-04-05', v_property_id, 'INC_CASH', 769.15, 'CASH', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (кеш)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-04-05', v_property_id, 'INC_BANK', 733.22, 'BANK', 'Дневен оборот', 'Рецепция+Ресторант+Лоби (ПОС)', v_user_id, v_acc_inc) ON CONFLICT DO NOTHING;

  -- Захранвания: 'драго' = CO→property transfer; others = INC_OTHER cash
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-01', v_property_id, 'INC_OTHER', 5650.0, 'CASH', 'DREAM LIFE TRAVEL', 'Захранване каса', v_user_id, v_acc_inc);
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-01', v_property_id, 'INC_OTHER', 500.0, 'CASH', 'рапсоди турция', 'Захранване каса', v_user_id, v_acc_inc);
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-17', v_property_id, 'INC_OTHER', 1488.0, 'CASH', 'сухи пакети', 'Захранване каса', v_user_id, v_acc_inc);
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-17', v_property_id, 'INC_OTHER', 92.0, 'CASH', 'наем анекс', 'Захранване каса', v_user_id, v_acc_inc);
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-30', v_property_id, 'INC_OTHER', 100.0, 'CASH', 'депозит синема', 'Захранване каса', v_user_id, v_acc_inc);
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-01-04', v_property_id, 'INC_OTHER', 100.0, 'CASH', 'йога', 'Захранване каса', v_user_id, v_acc_inc);
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-11', v_property_id, 'CF_TRANSFER', 17100.0, 'CASH', 'ЦО (Драго)', 'Захранване от ЦО', v_user_id, v_acc_inc);
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-02-21', v_property_id, 'INC_OTHER', 96.0, 'CASH', 'травел проджек', 'Захранване каса', v_user_id, v_acc_inc);
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-10', v_property_id, 'CF_TRANSFER', 5000.0, 'CASH', 'ЦО (Драго)', 'Захранване от ЦО', v_user_id, v_acc_inc);
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-11', v_property_id, 'INC_OTHER', 962.0, 'CASH', 'френц каса', 'Захранване каса', v_user_id, v_acc_inc);
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-12', v_property_id, 'INC_OTHER', 45.0, 'CASH', 'йога', 'Захранване каса', v_user_id, v_acc_inc);
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-14', v_property_id, 'CF_TRANSFER', 13500.0, 'CASH', 'ЦО (Драго)', 'Захранване от ЦО', v_user_id, v_acc_inc);
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-21', v_property_id, 'INC_OTHER', 44.0, 'CASH', 'игри топчета', 'Захранване каса', v_user_id, v_acc_inc);
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-03-27', v_property_id, 'INC_OTHER', 80.0, 'CASH', 'френц такса', 'Захранване каса', v_user_id, v_acc_inc);
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-04-03', v_property_id, 'INC_OTHER', 90.0, 'CASH', 'йога', 'Захранване каса', v_user_id, v_acc_inc);
  INSERT INTO income_entries (entry_date, property_id, type, amount, payment_method, payer, description, created_by_id, account_id) VALUES ('2026-04-04', v_property_id, 'INC_OTHER', 150.0, 'CASH', 'РОЖДЕН ДЕН', 'Захранване каса', v_user_id, v_acc_inc);

END $$;

-- List imported expenses
SELECT * FROM imported_exp;
COMMIT;

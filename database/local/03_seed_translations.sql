-- Local development only: Turkish translations for the synthetic pilot content (02_seed_content.sql).
-- Rows are matched by the English title and inserted only when missing. Idempotent.
USE [FirstSteps_Dev];
GO
IF DB_NAME() <> N'FirstSteps_Dev' THROW 51000, 'Wrong database selected.', 1;
GO
SET NOCOUNT ON;

DECLARE @Tasks TABLE (TaskTitle NVARCHAR(200), TitleTr NVARCHAR(200), DescriptionTr NVARCHAR(1000));
INSERT INTO @Tasks VALUES
 (N'Review your learning agreement', N'Öğrenim anlaşmanı gözden geçir', N'Erasmus öğrenim anlaşmandaki derslerin, kendi üniversitenin ve gideceğin üniversitenin onayladığı derslerle aynı olduğunu kontrol et.'),
 (N'Check entry requirements for your nationality', N'Vatandaşlığına göre giriş koşullarını kontrol et', N'Vatandaşlığına ve eğitim süresine göre vize veya oturma iznine ihtiyacın olup olmadığını öğren.'),
 (N'Arrange accommodation', N'Kalacak yer ayarla', N'Eğitim süren boyunca kalacağın bir yer bul: öğrenci yurdu ya da özel kiralık ev.'),
 (N'Confirm check-in details with your accommodation', N'Konaklama yerinle giriş ayrıntılarını netleştir', N'Konaklama sağlayıcından adresi, giriş saatini ve anahtarları nasıl alacağını öğren.'),
 (N'Arrange health insurance', N'Sağlık sigortanı ayarla', N'Kaldığın süre boyunca sağlık hizmetlerinden yararlanabildiğinden emin ol; örneğin Avrupa Sağlık Sigortası Kartı (EHIC) veya özel sigorta ile.'),
 (N'Plan your route to Liepāja', N'Liepāja''ya nasıl gideceğini planla', N'Varış günü havalimanından veya istasyondan Liepāja''ya nasıl ulaşacağını önceden planla.'),
 (N'Move in and check your accommodation', N'Yerleş ve kaldığın yeri kontrol et', N'Yerleş, odanın durumunu kontrol et ve kira sözleşmenin bir kopyasını sakla.'),
 (N'Register at the international office', N'Uluslararası ofise kayıt ol', N'Varışını teyit etmek için belgelerinle birlikte uluslararası ofise git.'),
 (N'Activate your student portal account', N'Öğrenci portalı hesabını etkinleştir', N'E-posta, ders programı ve ders materyallerine erişmek için üniversitedeki bilişim hesabını etkinleştir.'),
 (N'Get a local mobile connection', N'Yerel bir mobil hat edin', N'Yerel mobil tarifeleri karşılaştır ve gerekirse bir SIM kart veya eSIM al.'),
 (N'Declare your place of residence', N'Yaşadığın adresi bildir', N'Letonya''da adresini bildirmen gerekip gerekmediğini ve bunu nasıl yapacağını öğren.'),
 (N'Learn the city public transport', N'Şehirdeki toplu taşımayı öğren', N'Liepāja''da biletlerin, hatların ve sefer saatlerinin nasıl işlediğini öğren.'),
 (N'Attend orientation week', N'Oryantasyon haftasına katıl', N'Değişim öğrencileri için düzenlenen oryantasyon etkinliklerine katıl.'),
 (N'Confirm your course enrolment', N'Ders kaydını kontrol et', N'Derslerine kayıtlı olduğunu ve ders programında çakışma olmadığını kontrol et.'),
 (N'Save emergency and healthcare contacts', N'Acil durum ve sağlık numaralarını kaydet', N'AB acil çağrı numarası 112''yi kaydet ve sana en yakın sağlık merkezini bul.'),
 (N'Report learning agreement changes', N'Öğrenim anlaşmandaki değişiklikleri bildir', N'Varıştan sonra derslerin değiştiyse öğrenim anlaşmanı süresi içinde güncelle.'),
 (N'Open a local bank account', N'Yerel bir banka hesabı aç', N'Uzun süreli kalış için yerel bir banka hesabına ihtiyacın olup olmadığına karar ver.'),
 (N'Join a student community event', N'Bir öğrenci topluluğu etkinliğine katıl', N'Bir buddy veya öğrenci kulübü etkinliğinde diğer öğrencilerle tanış.');

INSERT INTO dbo.Task_Template_Translations (TaskID, LanguageCode, TaskTitle, Description)
SELECT t.TaskID, 'tr', s.TitleTr, s.DescriptionTr
  FROM @Tasks s
  JOIN dbo.Task_Templates t ON t.TaskTitle = s.TaskTitle
 WHERE NOT EXISTS (SELECT 1 FROM dbo.Task_Template_Translations x WHERE x.TaskID = t.TaskID AND x.LanguageCode = 'tr');

DECLARE @Sources TABLE (SourceTitle NVARCHAR(200), TitleTr NVARCHAR(200));
INSERT INTO @Sources VALUES
 (N'Erasmus+ programme information', N'Erasmus+ programı bilgileri'),
 (N'Office of Citizenship and Migration Affairs (PMLP)', N'Vatandaşlık ve Göç İşleri Ofisi (PMLP)'),
 (N'Your Europe: health care abroad', N'Your Europe: yurt dışında sağlık hizmetleri'),
 (N'RTU international students', N'RTU uluslararası öğrenciler'),
 (N'RTU website', N'RTU web sitesi'),
 (N'Liepāja city website', N'Liepāja belediyesi web sitesi');

INSERT INTO dbo.Information_Source_Translations (SourceID, LanguageCode, SourceTitle)
SELECT i.SourceID, 'tr', s.TitleTr
  FROM @Sources s
  JOIN dbo.Information_Sources i ON i.SourceTitle = s.SourceTitle
 WHERE NOT EXISTS (SELECT 1 FROM dbo.Information_Source_Translations x WHERE x.SourceID = i.SourceID AND x.LanguageCode = 'tr');

SELECT (SELECT COUNT(*) FROM dbo.Task_Template_Translations) AS TemplateTranslations,
       (SELECT COUNT(*) FROM dbo.Information_Source_Translations) AS SourceTranslations;
GO

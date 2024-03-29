
require'webb_query'

function webb.lang_schema()

	tables.lang = {
		lang                , lang, pk,
		rtl                 , bool0,
		en_name             , name, not_null, uk(en_name),
		name                , name, not_null, uk(name),
		decimal_separator   , str, {maxlen = 4, size = 16}, utf8_bin, not_null, default ',',
		thousands_separator , str, {maxlen = 4, size = 16}, utf8_bin, not_null, default '.',
	}

	--https://en.wikipedia.org/wiki/Languages_used_on_the_Internet
	--https://meta.wikimedia.org/wiki/Template:List_of_language_names_ordered_by_code
	tables.lang.rows = {
		{'en', false, 'English'    , 'English',          '.', ','},
		{'ru', false, 'Russian'    , 'Русский',          ',', '.'},
		{'tr', false, 'Turkish'    , 'Türkçe',           ',', '.'},
		{'es', false, 'Spanish'    , 'Español',          ',', '.'},
		{'fa', true , 'Persian'    , 'فارسی',              '٫' , '٬'},
		{'fr', false, 'French'     , 'Français',         ',', '.'},
		{'de', false, 'German'     , 'Deutsch',          ',', '.'},
		{'ja', false, 'Japanese'   , '日本語',             '.', ','},
		{'vi', false, 'Vietnamese' , 'Việtnam',          ',', '.'},
		{'zh', false, 'Chinese'    , '中文',              '.', ','},
		{'ar', true , 'Arabic'     , 'العربية',              '٫‎' , '٬'},
		{'pt', false, 'Portuguese' , 'Português',        ',', '.'},
		{'el', false, 'Greek'      , 'Ελληνικά',         ',', '.'},
		{'it', false, 'Italian'    , 'Italiano',         ',', '.'},
		{'id', false, 'Indonesian' , 'Bahasa Indonesia', ',', '.'},
		{'uk', false, 'Ukrainian'  , 'Українська',       ',', '.'},
		{'pl', false, 'Polish'     , 'Polski',           ',', '.'},
		{'nl', false, 'Dutch'      , 'Nederlands',       ',', '.'},
		{'ko', false, 'Korean'     , '한국어',            '.', ','},
		{'he', true , 'Hebrew'     , 'עברית',            '.', ','},
		{'th', false, 'Thai'       , 'ไทย',                '.', ','},
		{'cs', false, 'Czech'      , 'Česky',            ',', '.'},
		{'ro', false, 'Romanian'   , 'Română',           ',', '.'},
		{'sv', false, 'Swedish'    , 'Svenska',          ',', '.'},
		{'sr', false, 'Serbian'    , 'Српски',           ',', '.'},
		{'hu', false, 'Hungarian'  , 'Magyar',           ',', '.'},
		{'da', false, 'Danish'     , 'Dansk',            ',', '.'},
		{'bg', false, 'Bulgarian'  , 'Български',        ',', '.'},
		{'fi', false, 'Finnish'    , 'Suomi',            ',', '.'},
		{'sk', false, 'Slovak'     , 'Slovenčina',       ',', '.'},
		{'hr', false, 'Croatian'   , 'Hrvatski',         ',', '.'},
		{'hi', false, 'Hindi'      , 'हिन्दी',               '.', ','},
		{'lt', false, 'Lithuanian' , 'Lietuvių',         ',', '.'},
		{'no', false, 'Norwegian'  , 'Norsk',            ',', '.'},
		{'sl', false, 'Slovenian'  , 'Slovenščina',      ',', '.'},
		{'ms', false, 'Malay'      , 'Bahasa Melayu',    '.', ','},
		{'ca', false, 'Catalan'    , 'Català',           '.', ','},
		{'sq', false, 'Albanian'   , 'Shqip',            '.', ','},
		--less spoken but official languages
		--TODO: separators, see https://en.wikipedia.org/wiki/Decimal_separator
		{'am', false, 'Amharic'    , 'አማርኛ',            '.', ','},
		{'as', false, 'Assamese'   , 'অসমীয়া',           '.', ','},
		{'az', false, 'Azerbaijani', 'آذربايجان',           '.', ','},
		{'be', false, 'Belarusian' , 'Беларуская',       '.', ','},
		{'bi', false, 'Bislama'    , 'Bislama',          '.', ','},
		{'bn', false, 'Bengali'    , 'বাংলা',             '.', ','},
		{'bs', false, 'Bosnian'    , 'Bosanski',         '.', ','},
		{'dv', true , 'Divehi'     , 'ދިވެހިބަސް',           '.', ','},
		{'dz', false, 'Dzongkha'   , 'ཇོང་ཁ',                '.', ','},
		{'et', false, 'Estonian'   , 'Eesti',            '.', ','},
		{'fo', false, 'Faroese'    , 'Føroyskt',         '.', ','},
		{'hy', false, 'Armenian'   , 'Հայերեն',          '.', ','},
		{'is', false, 'Icelandic'  , 'Íslenska',         '.', ','},
		{'ka', false, 'Georgian'   , 'ქართული',        '.', ','},
		{'kk', false, 'Kazakh'     , 'Қазақша',          '.', ','},
		{'kl', false, 'Greenlandic', 'Kalaallisut',      '.', ','},
		{'km', false, 'Cambodian'  , 'ភាសាខ្មែរ',           '.', ','},
		{'ky', false, 'Kirghiz'    , 'Кыргызча',         '.', ','},
		{'lb', false, 'Luxembourgish', 'Lëtzebuergesch', '.', ','},
		{'lo', false, 'Laotian'    , 'ລາວ',              '.', ','},
		{'lv', false, 'Latvian'    , 'Latviešu',         '.', ','},
		{'mg', false, 'Malagasy'   , 'Malagasy',         '.', ','},
		{'mi', false, 'Māori'      , 'Māori',            '.', ','},
		{'mk', false, 'Macedonian' , 'Македонски',       '.', ','},
		{'mn', false, 'Mongolian'  , 'Монгол',           '.', ','},
		{'mt', false, 'Maltese'    , 'Malti',            '.', ','},
		{'my', false, 'Burmese'    , 'Myanmasa',         '.', ','},
		{'na', false, 'Nauruan'    , 'Dorerin Naoero',   '.', ','},
		{'ne', false, 'Nepali'     , 'नेपाली',              '.', ','},
		{'rw', false, 'Rwandi'     , 'Kinyarwandi',      '.', ','},
		{'si', false, 'Sinhalese'  , 'සිංහල',            '.', ','},
		{'sm', false, 'Samoan'     , 'Gagana Samoa',     '.', ','},
		{'so', false, 'Somalia'    , 'Soomaaliga',       '.', ','},
		{'sw', false, 'Swahili'    , 'Kiswahili',        '.', ','},
		{'tg', false, 'Tajik'      , 'Тоҷикӣ',           '.', ','},
		{'ti', false, 'Tigrinya'   , 'ትግርኛ',            '.', ','},
		{'tk', false, 'Turkmen'    , 'تركمن',             '.', ','},
		{'uz', false, 'Uzbek'      , 'Ўзбек',            '.', ','},
	}


	tables.currency = {
		currency    , currency, not_null, pk,
		decimals    , int16, not_null,
		en_name     , name, not_null, uk(currency, en_name),
		symbol      , name,
	}

	--https://en.wikipedia.org/wiki/List_of_circulating_currencies
	tables.currency.rows = {
		{'AED', 2, 'United Arab Emirates dirham'             , 'د.إ'},
		{'AFN', 2, 'Afghan afghani'                          , '؋'},
		{'ALL', 2, 'Albanian lek'                            , 'L'},
		{'AMD', 2, 'Armenian dram'                           , '֏'},
		{'ANG', 2, 'Netherlands Antillean guilder'           , 'ƒ'},
		{'AOA', 2, 'Angolan kwanza'                          , 'Kz'},
		{'ARS', 2, 'Argentine peso'                          , '$'},
		{'AUD', 2, 'Australian dollar'                       , '$'},
		{'AWG', 2, 'Aruban florin'                           , 'ƒ'},
		{'AZN', 2, 'Azerbaijani manat'                       , '₼'},
		{'BAM', 2, 'Bosnia and Herzegovina convertible mark' , 'KM'},
		{'BBD', 2, 'Barbadian dollar'                        , '$'},
		{'BDT', 2, 'Bangladeshi taka'                        , '৳'},
		{'BGN', 2, 'Bulgarian lev'                           , 'лв'},
		{'BHD', 3, 'Bahraini dinar'                          , '.د.ب'},
		{'BIF', 0, 'Burundian franc'                         , 'Fr'},
		{'BMD', 2, 'Bermudian dollar'                        , '$'},
		{'BND', 2, 'Brunei dollar'                           , '$'},
		{'BOB', 2, 'Bolivian boliviano'                      , 'Bs'},
		{'BRL', 2, 'Brazilian real'                          , 'R$'},
		{'BSD', 2, 'Bahamian dollar'                         , '$'},
		{'BTN', 2, 'Bhutanese ngultrum'                      , 'Nu'},
		{'BWP', 2, 'Botswana pula'                           , 'P'},
		{'BYN', 0, 'Belarusian ruble'                        , 'Br'},
		{'BZD', 2, 'Belize dollar'                           , '$'},
		{'CAD', 2, 'Canadian dollar'                         , '$'},
		{'CDF', 2, 'Congolese franc'                         , 'Fr'},
		{'CHF', 2, 'Swiss franc'                             , 'Fr'},
		{'CKD', 2, 'Cook Islands dollar'                     , '$'},
		{'CLP', 0, 'Chilean peso'                            , '$'},
		{'CNY', 2, 'Chinese yuan'                            , '¥'},
		{'COP', 2, 'Colombian peso'                          , '$'},
		{'CRC', 2, 'Costa Rican colón'                       , '₡'},
		{'CUP', 2, 'Cuban peso'                              , '$'},
		{'CVE', 0, 'Cape Verdean escudo'                     , '$'},
		{'CZK', 2, 'Czech koruna'                            , 'Kč'},
		{'DJF', 0, 'Djiboutian franc'                        , 'Fr'},
		{'DKK', 2, 'Danish krone'                            , 'kr'},
		{'DOP', 2, 'Dominican peso'                          , 'RD$'},
		{'DZD', 2, 'Algerian dinar'                          , 'د.ج'},
		{'EGP', 2, 'Egyptian pound'                          , 'ج.م'},
		{'ERN', 2, 'Eritrean nakfa'                          , 'Nfk'},
		{'ETB', 2, 'Ethiopian birr'                          , 'Br'},
		{'EUR', 2, 'Euro'                                    , '€'},
		{'FJD', 2, 'Fijian dollar'                           , '$'},
		{'FKP', 2, 'Falkland Islands pound'                  , '£'},
		{'FOK', 2, 'Faroese króna'                           , 'kr'},
		{'GBP', 2, 'British pound'                           , '£'},
		{'GEL', 2, 'Georgian lari'                           , '₾'},
		{'GGP', 2, 'Guernsey pound'                          , '£'},
		{'GHS', 2, 'Ghanaian cedi'                           , '₵'},
		{'GIP', 2, 'Gibraltar pound'                         , '£'},
		{'GMD', 2, 'Gambian dalasi'                          , 'D'},
		{'GNF', 0, 'Guinean franc'                           , 'Fr'},
		{'GTQ', 2, 'Guatemalan quetzal'                      , 'Q'},
		{'GYD', 2, 'Guyanese dollar'                         , '$'},
		{'HKD', 2, 'Hong Kong dollar'                        , '$'},
		{'HNL', 2, 'Honduran lempira'                        , 'L'},
		{'HRK', 2, 'Croatian kuna'                           , 'kn'},
		{'HTG', 2, 'Haitian gourde'                          , 'G'},
		{'HUF', 2, 'Hungarian forint'                        , 'Ft'},
		{'IDR', 2, 'Indonesian rupiah'                       , 'Rp'},
		{'ILS', 2, 'Israeli new shekel'                      , '₪'},
		{'IMP', 2, 'Manx pound'                              , '£'},
		{'INR', 2, 'Indian rupee'                            , '₹'},
		{'IQD', 3, 'Iraqi dinar'                             , 'ع.د'},
		{'IRR', 0, 'Iranian rial'                            , '﷼'},
		{'ISK', 0, 'Icelandic króna'                         , 'kr'},
		{'JEP', 2, 'Jersey pound'                            , '£'},
		{'JMD', 2, 'Jamaican dollar'                         , '$'},
		{'JOD', 3, 'Jordanian dinar'                         , 'د.ا'},
		{'JPY', 0, 'Japanese yen'                            , '¥'},
		{'KES', 2, 'Kenyan shilling'                         , 'Sh'},
		{'KGS', 2, 'Kyrgyzstani som'                         , 'с'},
		{'KHR', 2, 'Cambodian riel'                          , '៛'},
		{'KID', 2, 'Kiribati dollar'                         , '$'},
		{'KMF', 0, 'Comorian franc'                          , 'Fr'},
		{'KPW', 0, 'North Korean won'                        , '₩'},
		{'KRW', 0, 'South Korean won'                        , '₩'},
		{'KWD', 3, 'Kuwaiti dinar'                           , 'د.ك'},
		{'KYD', 2, 'Cayman Islands dollar'                   , '$'},
		{'KZT', 2, 'Kazakhstani tenge'                       , '₸'},
		{'LAK', 0, 'Lao kip'                                 , '₭'},
		{'LBP', 0, 'Lebanese pound'                          , 'ل.ل'},
		{'LKR', 2, 'Sri Lankan rupee'                        , 'Rs'},
		{'LRD', 2, 'Liberian dollar'                         , '$'},
		{'LSL', 2, 'Lesotho loti'                            , 'L'},
		{'LYD', 3, 'Libyan dinar'                            , 'ل.د'},
		{'MAD', 2, 'Moroccan dirham'                         , 'د.م'},
		{'MDL', 2, 'Moldovan leu'                            , 'L'},
		{'MGA', 0, 'Malagasy ariary'                         , 'Ar'},
		{'MKD', 0, 'Macedonian denar'                        , 'ден'},
		{'MMK', 0, 'Burmese kyat'                            , 'Ks'},
		{'MNT', 2, 'Mongolian tögrög'                        , '₮'},
		{'MOP', 2, 'Macanese pataca'                         , 'MOP$'},
		{'MRU', 0, 'Mauritanian ouguiya'                     , 'UM'},
		{'MUR', 2, 'Mauritian rupee'                         , '₨'},
		{'MVR', 2, 'Maldivian rufiyaa'                       , '.ރ'},
		{'MWK', 2, 'Malawian kwacha'                         , 'MK'},
		{'MXN', 2, 'Mexican peso'                            , '$'},
		{'MYR', 2, 'Malaysian ringgit'                       , 'RM'},
		{'MZN', 2, 'Mozambican metical'                      , 'MT'},
		{'NAD', 2, 'Namibian dollar'                         , '$'},
		{'NGN', 2, 'Nigerian naira'                          , '₦'},
		{'NIO', 2, 'Nicaraguan córdoba'                      , 'C$'},
		{'NOK', 2, 'Norwegian krone'                         , 'kr'},
		{'NPR', 2, 'Nepalese rupee'                          , 'रू'},
		{'NZD', 2, 'New Zealand dollar'                      , '$'},
		{'OMR', 3, 'Omani rial'                              , 'ر.ع'},
		{'PAB', 2, 'Panamanian balboa'                       , 'B/.'},
		{'PEN', 2, 'Peruvian sol'                            , 'S/.'},
		{'PGK', 2, 'Papua New Guinean kina'                  , 'K'},
		{'PHP', 2, 'Philippine peso'                         , '₱'},
		{'PKR', 2, 'Pakistani rupee'                         , '₨'},
		{'PLN', 2, 'Polish złoty'                            , 'zł'},
		{'PND', 2, 'Pitcairn Islands dollar'                 , '$'},
		{'PRB', 2, 'Transnistrian ruble'                     , 'р'},
		{'PYG', 0, 'Paraguayan guaraní'                      , '₲'},
		{'QAR', 2, 'Qatari riyal'                            , 'ر.ق'},
		{'RON', 2, 'Romanian leu'                            , 'lei'},
		{'RSD', 2, 'Serbian dinar'                           , 'дин'},
		{'RUB', 2, 'Russian ruble'                           , '₽'},
		{'RWF', 0, 'Rwandan franc'                           , 'Fr'},
		{'SAR', 2, 'Saudi riyal'                             , '﷼'},
		{'SBD', 2, 'Solomon Islands dollar'                  , '$'},
		{'SCR', 2, 'Seychellois rupee'                       , '₨'},
		{'SDG', 2, 'Sudanese pound'                          , 'ج.س'},
		{'SEK', 2, 'Swedish krona'                           , 'kr'},
		{'SGD', 2, 'Singapore dollar'                        , '$'},
		{'SHP', 2, 'Saint Helena pound'                      , '£'},
		{'SLL', 0, 'Sierra Leonean leone'                    , 'Le'},
		{'SLS', 2, 'Somaliland shilling'                     , 'Sl'},
		{'SOS', 2, 'Somali shilling'                         , 'Sh'},
		{'SRD', 2, 'Surinamese dollar'                       , '$'},
		{'SSP', 2, 'South Sudanese pound'                    , '£'},
		{'STN', 0, 'São Tomé and Príncipe dobra'             , 'Db'},
		{'SYP', 2, 'Syrian pound'                            , '£'},
		{'SZL', 2, 'Swazi lilangeni'                         , 'L'},
		{'THB', 2, 'Thai baht'                               , '฿'},
		{'TJS', 2, 'Tajikistani somoni'                      , 'с'},
		{'TMT', 2, 'Turkmenistan manat'                      , 'm'},
		{'TND', 3, 'Tunisian dinar'                          , 'د.ت'},
		{'TOP', 2, 'Tongan paʻanga'                           , 'T$'},
		{'TRY', 2, 'Turkish lira'                            , '₺'},
		{'TTD', 2, 'Trinidad and Tobago dollar'              , '$'},
		{'TVD', 2, 'Tuvaluan dollar'                         , '$'},
		{'TWD', 2, 'New Taiwan dollar'                       , '$'},
		{'TZS', 2, 'Tanzanian shilling'                      , 'Sh'},
		{'UAH', 2, 'Ukrainian hryvnia'                       , '₴'},
		{'UGX', 2, 'Ugandan shilling'                        , 'Sh'},
		{'USD', 2, 'United States dollar'                    , '$'},
		{'UYU', 2, 'Uruguayan peso'                          , '$'},
		{'UZS', 2, 'Uzbekistani soʻm'                         , 'Sʻ'},
		{'VES', 2, 'Venezuelan bolívar soberano'             , 'Bs'},
		{'VND', 0, 'Vietnamese đồng'                         , '₫'},
		{'VUV', 0, 'Vanuatu vatu'                            , 'Vt'},
		{'WST', 2, 'Samoan tālā'                             , 'T'},
		{'XAF', 0, 'Central African CFA franc'               , 'Fr'},
		{'XCD', 2, 'Eastern Caribbean dollar'                , '$'},
		{'XOF', 0, 'West African CFA franc'                  , 'Fr'},
		{'XPF', 0, 'CFP franc'                               , '₣'},
		{'YER', 2, 'Yemeni rial'                             , '﷼'},
		{'ZAR', 2, 'South African rand'                      , 'R'},
		{'ZMW', 2, 'Zambian kwacha'                          , 'ZK'},
		{'VEB', 0, 'Venezuelan bolívar'                      , 'BsD'},
	}

	tables.country = {
		country     , country, not_null, pk,
		lang        , lang, not_null, fk,
		currency    , currency, fk,
		imperial_system, bool0,
		en_name     , name, not_null,
	}

	--https://en.wikipedia.org/wiki/List_of_ISO_3166_country_codes
	--https://wiki.openstreetmap.org/wiki/Nominatim/Country_Codes
	--https://unece.org/fileadmin/DAM/cefact/recommendations/bkup_htm/cocucod1.htm
	tables.country.rows = {
		{'AD', 'ca', 'EUR', false, 'Andorra'},
		{'AE', 'ar', 'AED', false, 'United Arab Emirates'},
		{'AF', 'fa', 'AFN', false, 'Afghanistan'},
		{'AG', 'en', 'XCD', false, 'Antigua and Barbuda'},
		{'AI', 'en', 'XCD', false, 'Anguilla'},
		{'AL', 'sq', 'ALL', false, 'Albania'},
		{'AM', 'hy', 'AMD', false, 'Armenia'},
		{'AO', 'pt', 'AOA', false, 'Angola'},
		{'AQ', 'en', null , false, 'Antarctica'},
		{'AR', 'es', 'ARS', false, 'Argentina'},
		{'AS', 'en', 'USD', false, 'American Samoa'},
		{'AT', 'de', 'EUR', false, 'Austria'},
		{'AU', 'en', 'AUD', false, 'Australia'},
		{'AW', 'nl', 'AWG', false, 'Aruba'},
		{'AX', 'sv', null , false, 'Åland Islands'},
		{'AZ', 'az', 'AZN', false, 'Azerbaijan'},
		{'BA', 'bs', 'BAM', false, 'Bosnia and Herzegovina'},
		{'BB', 'en', 'BBD', false, 'Barbados'},
		{'BD', 'bn', 'BDT', false, 'Bangladesh'},
		{'BE', 'nl', 'EUR', false, 'Belgium'},
		{'BF', 'fr', 'XOF', false, 'Burkina Faso'},
		{'BG', 'bg', 'BGN', false, 'Bulgaria'},
		{'BH', 'ar', 'BHD', false, 'Bahrain'},
		{'BI', 'fr', 'BIF', false, 'Burundi'},
		{'BJ', 'fr', 'XOF', false, 'Benin'},
		{'BL', 'fr', null , false, 'Saint Barthélemy'},
		{'BM', 'en', 'BMD', false, 'Bermuda'},
		{'BN', 'ms', 'BND', false, 'Brunei Darussalam'},
		{'BO', 'es', 'BOB', false, 'Bolivia'},
		{'BQ', 'nl', null , false, 'Bonaire'},
		{'BR', 'pt', 'BRL', false, 'Brazil'},
		{'BS', 'en', 'BSD', false, 'Bahamas'},
		{'BT', 'dz', 'INR', false, 'Bhutan'},
		{'BV', 'no', 'NOK', false, 'Bouvet Island'},
		{'BW', 'en', 'BWP', false, 'Botswana'},
		{'BY', 'be', 'BYN', false, 'Belarus'},
		{'BZ', 'en', 'BZD', false, 'Belize'},
		{'CA', 'en', 'CAD', false, 'Canada'},
		{'CC', 'en', 'AUD', false, 'Cocos Islands'},
		{'CD', 'fr', 'CDF', false, 'Congo, the Democratic Republic of the'},
		{'CF', 'fr', 'XAF', false, 'Central African Republic'},
		{'CG', 'fr', 'XAF', false, 'Congo'},
		{'CH', 'de', 'CHF', false, 'Switzerland'},
		{'CI', 'fr', 'XOF', false, 'Côte d\'Ivoire'},
		{'CK', 'en', 'NZD', false, 'Cook Islands'},
		{'CL', 'es', 'CLP', false, 'Chile'},
		{'CM', 'fr', 'XAF', false, 'Cameroon'},
		{'CN', 'zh', 'CNY', false, 'China'},
		{'CO', 'es', 'COP', false, 'Colombia'},
		{'CR', 'es', 'CRC', false, 'Costa Rica'},
		{'CU', 'es', 'CUP', false, 'Cuba'},
		{'CV', 'pt', 'CVE', false, 'Cape Verde'},
		{'CW', 'nl', 'ANG', false, 'Curaçao'},
		{'CX', 'en', 'AUD', false, 'Christmas Island'},
		{'CY', 'el', 'EUR', false, 'Cyprus'},
		{'CZ', 'cs', 'CZK', false, 'Czech Republic'},
		{'DE', 'de', 'EUR', false, 'Germany'},
		{'DJ', 'fr', 'DJF', false, 'Djibouti'},
		{'DK', 'da', 'DKK', false, 'Denmark'},
		{'DM', 'en', 'XCD', false, 'Dominica'},
		{'DO', 'es', 'DOP', false, 'Dominican Republic'},
		{'DZ', 'ar', 'DZD', false, 'Algeria'},
		{'EC', 'es', 'USD', false, 'Ecuador'},
		{'EE', 'et', 'EUR', false, 'Estonia'},
		{'EG', 'ar', 'EGP', false, 'Egypt'},
		{'EH', 'ar', 'MAD', false, 'Western Sahara'},
		{'ER', 'ti', 'ERN', false, 'Eritrea'},
		{'ES', 'as', 'EUR', false, 'Spain'},
		{'ET', 'am', 'ETB', false, 'Ethiopia'},
		{'FI', 'fi', 'EUR', false, 'Finland'},
		{'FJ', 'en', 'FJD', false, 'Fiji'},
		{'FK', 'en', 'FKP', false, 'Falkland Islands'},
		{'FM', 'en', 'USD', false, 'Micronesia'},
		{'FO', 'fo', 'FOK', false, 'Faroe Islands'},
		{'FR', 'fr', 'EUR', false, 'France'},
		{'GA', 'fr', 'XAF', false, 'Gabon'},
		{'GB', 'en', 'GBP', false, 'United Kingdom'},
		{'GD', 'en', 'XCD', false, 'Grenada'},
		{'GE', 'ka', 'GEL', false, 'Georgia'},
		{'GF', 'fr', 'EUR', false, 'French Guiana'},
		{'GG', 'en', 'GBP', false, 'Guernsey'},
		{'GH', 'en', 'GHS', false, 'Ghana'},
		{'GI', 'en', 'GIP', false, 'Gibraltar'},
		{'GL', 'kl', 'DKK', false, 'Greenland'},
		{'GM', 'en', 'GMD', false, 'Gambia'},
		{'GN', 'fr', 'GNF', false, 'Guinea'},
		{'GP', 'fr', 'EUR', false, 'Guadeloupe'},
		{'GQ', 'es', 'XAF', false, 'Equatorial Guinea'},
		{'GR', 'el', 'EUR', false, 'Greece'},
		{'GS', 'en', null , false, 'South Georgia and the South Sandwich Islands'},
		{'GT', 'es', 'GTQ', false, 'Guatemala'},
		{'GU', 'en', 'USD', false, 'Guam'},
		{'GW', 'pt', 'XOF', false, 'Guinea-Bissau'},
		{'GY', 'en', 'GYD', false, 'Guyana'},
		{'HK', 'zh', 'HKD', false, 'Hong Kong'},
		{'HM', 'en', 'AUD', false, 'Heard Island and McDonald Islands'},
		{'HN', 'es', 'HNL', false, 'Honduras'},
		{'HR', 'hr', 'HRK', false, 'Croatia'},
		{'HT', 'fr', 'HTG', false, 'Haiti'},
		{'HU', 'hu', 'HUF', false, 'Hungary'},
		{'ID', 'id', 'IDR', false, 'Indonesia'},
		{'IE', 'en', 'EUR', false, 'Ireland'},
		{'IL', 'he', 'ILS', false, 'Israel'},
		{'IM', 'en', 'GBP', false, 'Isle of Man'},
		{'IN', 'hi', 'INR', false, 'India'},
		{'IO', 'en', 'USD', false, 'British Indian Ocean Territory'},
		{'IQ', 'ar', 'IQD', false, 'Iraq'},
		{'IR', 'fa', 'IRR', false, 'Iran'},
		{'IS', 'is', 'ISK', false, 'Iceland'},
		{'IT', 'it', 'EUR', false, 'Italy'},
		{'JE', 'en', 'GBP', false, 'Jersey'},
		{'JM', 'en', 'JMD', false, 'Jamaica'},
		{'JO', 'ar', 'JOD', false, 'Jordan'},
		{'JP', 'ja', 'JPY', false, 'Japan'},
		{'KE', 'sw', 'KES', false, 'Kenya'},
		{'KG', 'ky', 'KGS', false, 'Kyrgyzstan'},
		{'KH', 'km', 'KHR', false, 'Cambodia'},
		{'KI', 'en', 'AUD', false, 'Kiribati'},
		{'KM', 'ar', 'KMF', false, 'Comoros'},
		{'KN', 'en', 'XCD', false, 'Saint Kitts and Nevis'},
		{'KP', 'ko', 'KPW', false, 'Korea, North'},
		{'KR', 'ko', 'KRW', false, 'Korea, South'},
		{'KW', 'ar', 'KWD', false, 'Kuwait'},
		{'KY', 'en', 'KYD', false, 'Cayman Islands'},
		{'KZ', 'kk', 'KZT', false, 'Kazakhstan'},
		{'LA', 'lo', 'LAK', false, 'Lao'},
		{'LB', 'ar', 'LBP', false, 'Lebanon'},
		{'LC', 'en', 'XCD', false, 'Saint Lucia'},
		{'LI', 'de', 'CHF', false, 'Liechtenstein'},
		{'LK', 'si', 'LKR', false, 'Sri Lanka'},
		{'LR', 'en', 'LRD', true , 'Liberia'},
		{'LS', 'en', 'ZAR', false, 'Lesotho'},
		{'LT', 'lt', 'EUR', false, 'Lithuania'},
		{'LU', 'lb', 'EUR', false, 'Luxembourg'},
		{'LV', 'lv', 'EUR', false, 'Latvia'},
		{'LY', 'ar', 'LYD', false, 'Libya'},
		{'MA', 'fr', 'MAD', false, 'Morocco'},
		{'MC', 'fr', 'EUR', false, 'Monaco'},
		{'MD', 'ro', 'MDL', false, 'Moldova'},
		{'ME', 'sr', 'EUR', false, 'Montenegro'},
		{'MF', 'fr', null , false, 'Saint Martin (French part}'},
		{'MG', 'mg', 'MGA', false, 'Madagascar'},
		{'MH', 'en', 'USD', false, 'Marshall Islands'},
		{'MK', 'mk', 'MKD', false, 'Macedonia'},
		{'ML', 'fr', 'XOF', false, 'Mali'},
		{'MM', 'my', 'MMK', true , 'Myanmar'},
		{'MN', 'mn', 'MNT', false, 'Mongolia'},
		{'MO', 'zh', 'MOP', false, 'Macao'},
		{'MP', 'en', 'USD', false, 'Northern Mariana Islands'},
		{'MQ', 'fr', 'EUR', false, 'Martinique'},
		{'MR', 'ar', 'MRU', false, 'Mauritania'},
		{'MS', 'en', 'XCD', false, 'Montserrat'},
		{'MT', 'mt', 'EUR', false, 'Malta'},
		{'MU', 'en', 'MUR', false, 'Mauritius'},
		{'MV', 'dv', 'MVR', false, 'Maldives'},
		{'MW', 'en', 'MWK', false, 'Malawi'},
		{'MX', 'es', 'MXN', false, 'Mexico'},
		{'MY', 'ms', 'MYR', false, 'Malaysia'},
		{'MZ', 'pt', 'MZN', false, 'Mozambique'},
		{'NA', 'en', 'ZAR', false, 'Namibia'},
		{'NC', 'fr', 'XPF', false, 'New Caledonia'},
		{'NE', 'fr', 'XOF', false, 'Niger'},
		{'NF', 'en', 'AUD', false, 'Norfolk Island'},
		{'NG', 'en', 'NGN', false, 'Nigeria'},
		{'NI', 'es', 'NIO', false, 'Nicaragua'},
		{'NL', 'nl', 'EUR', false, 'Netherlands'},
		{'NO', 'no', 'NOK', false, 'Norway'},
		{'NP', 'ne', 'NPR', false, 'Nepal'},
		{'NR', 'na', 'AUD', false, 'Nauru'},
		{'NU', 'en', 'NZD', false, 'Niue'},
		{'NZ', 'mi', 'NZD', false, 'New Zealand'},
		{'OM', 'ar', 'OMR', false, 'Oman'},
		{'PA', 'es', 'USD', false, 'Panama'},
		{'PE', 'es', 'PEN', false, 'Peru'},
		{'PF', 'fr', 'XPF', false, 'French Polynesia'},
		{'PG', 'en', 'PGK', false, 'Papua New Guinea'},
		{'PH', 'en', 'PHP', false, 'Philippines'},
		{'PK', 'en', 'PKR', false, 'Pakistan'},
		{'PL', 'pl', 'PLN', false, 'Poland'},
		{'PM', 'fr', 'EUR', false, 'Saint Pierre and Miquelon'},
		{'PN', 'en', 'NZD', false, 'Pitcairn'},
		{'PR', 'es', 'USD', false, 'Puerto Rico'},
		{'PS', 'ar', null , false, 'Palestine'},
		{'PT', 'pt', 'EUR', false, 'Portugal'},
		{'PW', 'en', 'USD', false, 'Palau'},
		{'PY', 'es', 'PYG', false, 'Paraguay'},
		{'QA', 'ar', 'QAR', false, 'Qatar'},
		{'RE', 'fr', 'EUR', false, 'Réunion'},
		{'RO', 'ro', 'RON', false, 'Romania'},
		{'RS', 'sr', 'RSD', false, 'Serbia'},
		{'RU', 'ru', 'RUB', false, 'Russian Federation'},
		{'RW', 'rw', 'RWF', false, 'Rwanda'},
		{'SA', 'ar', 'SAR', false, 'Saudi Arabia'},
		{'SB', 'en', 'SBD', false, 'Solomon Islands'},
		{'SC', 'fr', 'SCR', false, 'Seychelles'},
		{'SD', 'ar', 'SDG', false, 'Sudan'},
		{'SE', 'sv', 'SEK', false, 'Sweden'},
		{'SG', 'zh', 'BND', false, 'Singapore'},
		{'SH', 'en', 'SHP', false, 'Saint Helena'},
		{'SI', 'sl', 'EUR', false, 'Slovenia'},
		{'SJ', 'no', 'NOK', false, 'Svalbard and Jan Mayen'},
		{'SK', 'sk', 'EUR', false, 'Slovakia'},
		{'SL', 'en', 'SLL', false, 'Sierra Leone'},
		{'SM', 'it', 'EUR', false, 'San Marino'},
		{'SN', 'fr', 'XOF', false, 'Senegal'},
		{'SO', 'so', 'SOS', false, 'Somalia'},
		{'SR', 'nl', 'SRD', false, 'Suriname'},
		{'SS', 'en', 'SSP', false, 'South Sudan'},
		{'ST', 'pt', 'STN', false, 'Sao Tome and Principe'},
		{'SV', 'es', 'USD', false, 'El Salvador'},
		{'SX', 'nl', null , false, 'Sint Maarten (Dutch part}'},
		{'SY', 'ar', 'SYP', false, 'Syria'},
		{'SZ', 'en', 'SZL', false, 'Swaziland'},
		{'TC', 'en', 'USD', false, 'Turks and Caicos Islands'},
		{'TD', 'fr', 'XAF', false, 'Chad'},
		{'TF', 'fr', 'EUR', false, 'French Southern Territories'},
		{'TG', 'fr', 'XOF', false, 'Togo'},
		{'TH', 'th', 'THB', false, 'Thailand'},
		{'TJ', 'tg', 'TJS', false, 'Tajikistan'},
		{'TK', 'tk', 'NZD', false, 'Tokelau'},
		{'TL', 'pt', 'USD', false, 'Timor-Leste'},
		{'TM', 'tk', 'TMT', false, 'Turkmenistan'},
		{'TN', 'ar', 'TND', false, 'Tunisia'},
		{'TO', 'en', 'TOP', false, 'Tonga'},
		{'TR', 'tr', 'TRY', false, 'Turkey'},
		{'TT', 'en', 'TTD', false, 'Trinidad and Tobago'},
		{'TV', 'en', 'AUD', false, 'Tuvalu'},
		{'TW', 'zh', 'TWD', false, 'Taiwan'},
		{'TZ', 'sw', 'TZS', false, 'Tanzania'},
		{'UA', 'uk', 'UAH', false, 'Ukraine'},
		{'UG', 'en', 'UGX', false, 'Uganda'},
		{'UM', 'en', 'USD', false, 'United States Minor Outlying Islands'},
		{'US', 'en', 'USD', true , 'United States'},
		{'UY', 'es', 'UYU', false, 'Uruguay'},
		{'UZ', 'uz', 'UZS', false, 'Uzbekistan'},
		{'VA', 'it', 'EUR', false, 'Vatican'},
		{'VC', 'en', 'XCD', false, 'Saint Vincent and the Grenadines'},
		{'VE', 'es', 'VEB', false, 'Venezuela'},
		{'VG', 'en', 'USD', false, 'Virgin Islands, British'},
		{'VI', 'en', 'USD', false, 'Virgin Islands, U.S.'},
		{'VN', 'vi', 'VND', false, 'Viet Nam'},
		{'VU', 'bi', 'VUV', false, 'Vanuatu'},
		{'WF', 'fr', 'XPF', false, 'Wallis and Futuna'},
		{'WS', 'sm', 'WST', false, 'Samoa'},
		{'YE', 'ar', 'YER', false, 'Yemen'},
		{'YT', 'fr', 'EUR', false, 'Mayotte'},
		{'ZA', 'en', 'ZAR', false, 'South Africa'},
		{'ZM', 'en', 'ZMW', false, 'Zambia'},
		{'ZW', 'en',  null, false, 'Zimbabwe'},
	}

end

return webb.lang_schema

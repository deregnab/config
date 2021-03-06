﻿'use strict';

// Формат версии: https://developer.chrome.com/extensions/manifest/version
// В моем случае это UTC-дата выкладывания версии в сеть.
// 1 - год >= 2016
// 2 - месяц 1..12
// 3 - день месяца 1..31
// 4 - указывается только для версий, выпущенных в один день. >= 1, по умолчанию 0.
// Edge: Последнее число должно быть нулем.
// https://docs.microsoft.com/en-us/microsoft-edge/extensions/guides/packaging/creating-and-testing-extension-packages
const ВЕРСИЯ_РАСШИРЕНИЯ = '2019.2.20';
const ВЕРСИЯ_ДВИЖКА_БРАУЗЕРА = Number.parseInt(/Chrome\/(\d+)/.exec(navigator.userAgent)[1], 10);
const ЭТО_ПЛАНШЕТ = false;
const ЭТО_CONTENT_SCRIPT = !document.currentScript;

const АДРЕС_НЕ_ПЕРЕНАПРАВЛЯТЬ = 'twitch5=0';

// PointerEvent.button
const ЛЕВАЯ_КНОПКА          = 0;
const СРЕДНЯЯ_КНОПКА        = 1;
const ПРАВАЯ_КНОПКА         = 2;

// PointerEvent.buttons
const НАЖАТА_ЛЕВАЯ_КНОПКА   = 1;
const НАЖАТА_ПРАВАЯ_КНОПКА  = 2;
const НАЖАТА_СРЕДНЯЯ_КНОПКА = 4;

const ПАССИВНЫЙ_ОБРАБОТЧИК = Object.freeze({passive: true});

//
// м_Настройки
//

const МИН_ЗНАЧЕНИЕ_НАСТРОЙКИ  = Number.MIN_SAFE_INTEGER + 1000; // На будущее.
const МАКС_ЗНАЧЕНИЕ_НАСТРОЙКИ = Number.MAX_SAFE_INTEGER - 1000; // На будущее.
const АВТОНАСТРОЙКА           = Number.MIN_SAFE_INTEGER;        // См. комментарий в Настройка.ПроверитьЗначение().

// Edge 15 во всплывающей подсказке показывает текущее целое значение громкости,
// поэтому для интерфейса не подходит "родной" диапазон 0..1.
const МИНИМАЛЬНАЯ_ГРОМКОСТЬ           = 1;
const МАКСИМАЛЬНАЯ_ГРОМКОСТЬ          = 100;
const ШАГ_ПОВЫШЕНИЯ_ГРОМКОСТИ_КЛАВОЙ  = 4;
const ШАГ_ПОНИЖЕНИЯ_ГРОМКОСТИ_КЛАВОЙ  = 2;
const ШАГ_ИЗМЕНЕНИЯ_ГРОМКОСТИ_МЫШЬЮ   = 1;

// Эти константы также определены в player.html.
const ЧАТ_ВЫГРУЖЕН = 0;
const ЧАТ_СКРЫТ    = 1;
const ЧАТ_ПАНЕЛЬ   = 2;

// Эти константы также определены в player.html.
const ВЕРХНЯЯ_СТОРОНА = 1;
const ПРАВАЯ_СТОРОНА  = 2;
const НИЖНЯЯ_СТОРОНА  = 3;
const ЛЕВАЯ_СТОРОНА   = 4;

// По стандарту HLS минимальный интервал равен 50.
const МИН_ИНТЕРВАЛ_ОБНОВЛЕНИЯ_СПИСКОВ = 40; // Процент target duration.

// Если в удаляемом диапазоне есть ключевой кадр, то будут удалены все последующие кадры до ключевого кадра, не входящего
// в удаляемый диапазон. Таким образом возможна ситуация, когда будет удалено всё просмотренное видео и часть
// непросмотренного, что приведет к остановке воспроизведения. Чтобы этого не произошло, МИН_ДЛИТЕЛЬНОСТЬ_ПОВТОРА должна
// превышать расстояние между ключевыми кадрами. Чем больше видео в буфере, тем выше расход памяти, до 150 МиБ.
const МИН_ДЛИТЕЛЬНОСТЬ_ПОВТОРА  = 30;  // Секунды.
const МАКС_ДЛИТЕЛЬНОСТЬ_ПОВТОРА = 300; // Секунды.

// Chrome 59 + Windows + аппаратное декодирование: Для завершения перемотки и начала воспроизведения нужно не менее
// 4 кадров, не исключено, что иногда и больше. Без аппаратного декодирования достаточно 2 кадров.
const МИН_РАЗМЕР_БУФЕРА        = 1.5; // Секунды.
const МАКС_РАЗМЕР_БУФЕРА       =  30; // Секунды. TODO Измерять в сегментах?
const МИН_РАСТЯГИВАНИЕ_БУФЕРА  =   9; // Секунды. TODO Измерять в сегментах?
const МАКС_РАСТЯГИВАНИЕ_БУФЕРА =  30; // Секунды. TODO Измерять в сегментах?
const ПЕРЕПОЛНЕНИЕ_БУФЕРА      = МАКС_РАЗМЕР_БУФЕРА + МАКС_РАСТЯГИВАНИЕ_БУФЕРА; // TODO Избавиться от ПЕРЕПОЛНЕНИЕ_БУФЕРА.

let г_лРаботаЗавершена = false;

// Chrome 48-, Edge 16-
if (!window.URLSearchParams)
{
	window.URLSearchParams = class URLSearchParams
	{
		constructor(сПараметры)
		{
			Проверить(arguments.length === 1 && typeof сПараметры === 'string');
			this._амПараметры = new Map();
			if (сПараметры.length !== 0)
			{
				for (let сПараметр of сПараметры.split('&'))
				{
					const чРавно = сПараметр.indexOf('=');
					if (чРавно === -1)
					{
						const сИмя = decodeURIComponent(сПараметр);
						if (!this._амПараметры.has(сИмя))
						{
							this._амПараметры.set(сИмя, '');
						}
					}
					else
					{
						let сИмя = decodeURIComponent(сПараметр.slice(0, чРавно));
						if (!this._амПараметры.has(сИмя))
						{
							this._амПараметры.set(сИмя, decodeURIComponent(сПараметр.slice(чРавно + 1)));
						}
					}
				}
			}
		}

		has(сИмя)
		{
			return this._амПараметры.has(String(сИмя));
		}

		get(сИмя)
		{
			const сЗначение = this._амПараметры.get(String(сИмя));
			return сЗначение === undefined ? null : сЗначение;
		}
	};
}

// Chrome 59, Firefox 54
if (!window.setImmediate)
// Для моих целей пока достаточно setTimeout(). Нельзя использовать обещания.
{
	window.setImmediate = фВызвать =>
	{
		Проверить(typeof фВызвать === 'function');
		setTimeout(фВызвать, 0);
	};
}

// Chrome 50-
if (!NodeList.prototype[Symbol.iterator])
{
	NodeList.prototype[Symbol.iterator] = Array.prototype[Symbol.iterator];
}
if (!HTMLCollection.prototype[Symbol.iterator])
{
	HTMLCollection.prototype[Symbol.iterator] = Array.prototype[Symbol.iterator];
}

// Chrome 54-, Firefox 58-, Firefox Android
// Polyfill не рассчитан на работу в content script. Он добавляет window.PointerEvent только в
// content script, но посылает события (dispatchEvent) и в content script, и в web page script.
if (!ЭТО_CONTENT_SCRIPT && !window.PointerEvent)
{
	// Файл будет вставлен асинхронно, поэтому код инициализации всех модулей
	// расширения не должен зависить от наличия window.PointerEvent.
	const узСкрипт = document.createElement('script');
	узСкрипт.src = 'pointerevent.js';
	document.currentScript.parentNode.appendChild(узСкрипт);
}

const ЗАГЛУШКА = () => {};

function Проверить(пУсловие)
{
	if (!пУсловие)
	{
		throw new Error('Проверка не пройдена');
	}
}

function ДобавитьОбработчикИсключений(фФункция)
// фФункция - асинхронно вызываемая функция. Не следует её вызывать напрямую,
// потому что она не будет выполнена во время работы ЗавершитьРаботу().
{
	return function()
	{
		if (г_лРаботаЗавершена)
		{
			return;
		}
		try
		{
			return фФункция.apply(this, arguments);
		}
		catch (пИсключение)
		{
			м_Отладка.ПойманоИсключение(пИсключение);
		}
	};
}

function ПеревестиИсключениеВСтроку(пИсключение)
{
	return пИсключение instanceof Error ? пИсключение.stack
	     : `[typeof ${typeof пИсключение}] ${new Error(пИсключение).stack}`;
}

function Тип(пЗначение)
{
	return пЗначение === null ? 'null' : typeof пЗначение;
}

function ЭтоЧисло(пЗначение)
{
	return typeof пЗначение === 'number' && пЗначение === пЗначение;
}

function ЭтоОбъект(пЗначение)
{
	return typeof пЗначение === 'object' && пЗначение !== null;
}

function ЭтоНепустаяСтрока(пЗначение)
{
	return typeof пЗначение === 'string' && пЗначение !== '';
}

function ОграничитьДлинуСтроки(сСтрока, чМаксимальнаяДлина)
// Возвращаемая строка может быть на несколько символов длиннее чМаксимальнаяДлина.
{
	return сСтрока.length <= чМаксимальнаяДлина ? сСтрока : `${сСтрока.slice(0, чМаксимальнаяДлина)}---8<---${сСтрока.length - чМаксимальнаяДлина}`;
}

function Узел(пУзел)
{
	if (typeof пУзел === 'string')
	{
		пУзел = document.getElementById(пУзел);
	}
	Проверить(ЭтоОбъект(пУзел));
	return пУзел;
}

const м_Журнал = (() =>
{
	const КОЛИЧЕСТВО_ЗАПИСЕЙ_В_ЖУРНАЛЕ = 1500;
	const МАКС_ДЛИНА_ЗАПИСИ            = 1500;

	let _мсЖурнал = null; // Кольцевой буфер.
	let _чПоследняяЗапись = -1;

	function Добавить(сВажность, сЗапись)
	{
		if (_мсЖурнал)
		{
			Проверить(typeof сВажность === 'string' && typeof сЗапись === 'string');
			сЗапись = ОграничитьДлинуСтроки(`${сВажность} ${(performance.now() / 1000).toFixed(3)} ${сЗапись}`, МАКС_ДЛИНА_ЗАПИСИ);
			if (++_чПоследняяЗапись === _мсЖурнал.length)
			{
				_чПоследняяЗапись = 0;
			}
			_мсЖурнал[_чПоследняяЗапись] = сЗапись;
		}
	}

	function ПолучитьДанныеДляОтчета()
	{
		if (!_мсЖурнал)
		{
			return null;
		}
		const чСледующаяЗапись = _чПоследняяЗапись + 1;
		if (чСледующаяЗапись === _мсЖурнал.length)
		{
			return _мсЖурнал;
		}
		if (_мсЖурнал[чСледующаяЗапись] === undefined)
		{
			return _мсЖурнал.slice(0, чСледующаяЗапись);
		}
		return _мсЖурнал.slice(чСледующаяЗапись).concat(_мсЖурнал.slice(0, чСледующаяЗапись));
	}

	function Вот(сЗапись)
	{
		Проверить(arguments.length === 1);
		Добавить(' ', сЗапись);
	}

	function Окак(сЗапись)
	{
		Проверить(arguments.length === 1);
		Добавить('~', сЗапись);
	}

	function Ой(сЗапись)
	{
		Проверить(arguments.length === 1);
		Добавить('@', сЗапись);
	}

	function O(пОбъект)
	{
		switch (Тип(пОбъект))
		{
			case 'object':   return JSON.stringify(пОбъект);
			case 'function': return `[function ${пОбъект.name}]`;
			case 'symbol':   return '[symbol]';
			default:         return String(пОбъект);
		}
	}

	function F(чТочность)
	{
		return чЗначение => typeof чЗначение === 'number' ? чЗначение.toFixed(чТочность) : 'NaN';
	}

	if (!ЭТО_CONTENT_SCRIPT)
	{
		_мсЖурнал = new Array(КОЛИЧЕСТВО_ЗАПИСЕЙ_В_ЖУРНАЛЕ);
		Вот(`[Журнал] Журнал запущен ${performance.now().toFixed()}мс`);
	}

	return {
		Вот, Окак, Ой,
		O, F0: F(0), F1: F(1), F2: F(2), F3: F(3),
		ПолучитьДанныеДляОтчета
	};
})();

const м_i18n = (() =>
{
	const НАЗВАНИЯ_ЯЗЫКОВ =
	{
		'da':    'Dansk',
		'de':    'Deutsch',
		'en':    'English',
		'en-gb': 'English (UK)',
		'es':    'Español',
		'es-mx': 'Español (Latinoamérica)',
		'fr':    'Français',
		'it':    'Italiano',
		'hu':    'Magyar',
		'nl':    'Nederlands',
		'no':    'Norsk',
		'pl':    'Polski',
		'pt':    'Português',
		'pt-br': 'Português (Brasil)',
		'sk':    'Slovenčina',
		'fi':    'Suomi',
		'sv':    'Svenska',
		'vi':    'Tiếng Việt',
		'tr':    'Türkçe',
		'cs':    'Čeština',
		'el':    'Ελληνικά',
		'bg':    'Български',
		'ru':    'Русский',
		'ar':    'العربية',
		'th':    'ภาษาไทย',
		'zh':    '中文',
		'zh-cn': '简体中文',
		'zh-tw': '繁體中文',
		'zh-hk': '中文（香港）',
		'ja':    '日本語',
		'ko':    '한국어',
		'hi':    'हिंदी',
		'ro':    'Română',
		'ase':   'American Sign Language',
		'asl':   'American Sign Language' // Twitch передает этот неправильный код.
	};

	const _амФорматироватьЧисло = new Map();
	let _фФорматироватьДату = null;

	function GetMessage(sMessageName, sSubstitution)
	{
		Проверить(ЭтоНепустаяСтрока(sMessageName));
		Проверить(sSubstitution === undefined || typeof sSubstitution === 'string');
		const sMessageText = chrome.i18n.getMessage(sMessageName, sSubstitution);
		if (!sMessageText)
		{
			throw new Error(`Не найден текст ${sMessageName}`);
		}
		return sMessageText;
	}

	function FastInsertAdjacentHtmlMessage(elInsertTo, sPosition, sMessageName)
	{
		// Commentary for AMO reviewers: HTML content is taken from the file messages.json. See GetMessage().
		elInsertTo.insertAdjacentHTML(sPosition, GetMessage(sMessageName));
	}

	function InsertAdjacentHtmlMessage(vInsertTo, sPosition, sMessageName)
	{
		const elInsertTo = Узел(vInsertTo);
		if (sPosition === 'content')
		{
			sPosition = 'beforeend';
			elInsertTo.textContent = '';
		}
		FastInsertAdjacentHtmlMessage(elInsertTo, sPosition, sMessageName);
		return elInsertTo;
	}

	function TranslateDocument(оДокумент)
	{
		м_Журнал.Вот('[i18n] Перевод документа');
		// Chrome 50-: Итераторы я добавил только для текущего контекста, поэтому for...of использовать нельзя.
		for (let celTranslate = оДокумент.querySelectorAll('*[data-i18n]'), i = 0, elTranslate; elTranslate = celTranslate[i]; ++i)
		{
			const sNames = elTranslate.getAttribute('data-i18n');
			const sNamesDelimiter = sNames.indexOf('^');
			if (sNamesDelimiter !== 0)
			{
				FastInsertAdjacentHtmlMessage(elTranslate, 'afterbegin', sNamesDelimiter === -1 ? sNames : sNames.slice(0, sNamesDelimiter));
			}
			if (sNamesDelimiter !== -1)
			{
				elTranslate.title = GetMessage(sNames.slice(sNamesDelimiter + 1));
			}
		}
	}

	function ФорматироватьЧисло(пЧисло, кДробныхРазрядов /* необязательный */)
	{
		Проверить(кДробныхРазрядов === undefined || (typeof кДробныхРазрядов === 'number' && кДробныхРазрядов >= 0));
		let фФорматировать = _амФорматироватьЧисло.get(кДробныхРазрядов);
		if (!фФорматировать)
		{
			фФорматировать = (new Intl.NumberFormat(
				undefined,
				кДробныхРазрядов === undefined ? undefined :
				{
					minimumFractionDigits: кДробныхРазрядов,
					maximumFractionDigits: кДробныхРазрядов
				}
			)).format;
			_амФорматироватьЧисло.set(кДробныхРазрядов, фФорматировать);
		}
		return фФорматировать(пЧисло);
	}

	function ФорматироватьДату(пДата)
	// пДата - число с миллисекундами или объект Date.
	{
		Проверить(Number.isFinite(пДата) || Number.isFinite(пДата.getTime()));
		if (!_фФорматироватьДату)
		{
			// UNDONE Часовой пояс report://06542445556621_15337722633
			_фФорматироватьДату = (new Intl.DateTimeFormat(undefined, {timeZone: 'UTC'})).format;
		}
		return _фФорматироватьДату(пДата);
	}

	function ПеревестиСекундыВСтроку(кСекунды, лНужныСекунды)
	{
		let ч = Math.floor(кСекунды / 60 % 60);
		let с = Math.floor(кСекунды / 60 / 60) + (ч < 10 ? ' : 0' : ' : ') + ч;
		if (лНужныСекунды)
		{
			ч = Math.floor(кСекунды % 60);
			с += (ч < 10 ? ' : 0' : ' : ') + ч;
		}
		return с;
	}

	function ПолучитьНазваниеЯзыка(сКодЯзыка)
	{
		const сНазваниеЯзыка = НАЗВАНИЯ_ЯЗЫКОВ[сКодЯзыка.toLowerCase()];
		if (!сНазваниеЯзыка)
		{
			throw new Error(`Неизвестный код языка: ${сКодЯзыка}`);
		}
		return сНазваниеЯзыка;
	}

	return {
		GetMessage,
		InsertAdjacentHtmlMessage,
		TranslateDocument,
		ФорматироватьЧисло, ФорматироватьДату,
		ПеревестиСекундыВСтроку,
		ПолучитьНазваниеЯзыка
	};
})();

const м_Настройки = (() =>
{
	/***
	ВЕРСИЯ_НАСТРОЕК  Версия расширения  Изменения
	              1         2017.09.11  Добавлены предустановки
	              2         2017.11.06  чПоложениеПанелиЧата +ЛЕВАЯ_СТОРОНА +ВЕРХНЯЯ_СТОРОНА
	              2         2018.01.07  Добавлена проверка значений, экспорт и импорт всех настроек
	              2         2018.03.17  Добавлена лЗатемнитьЧат
	              2         2018.04.06  Добавлены чСостояниеЗакрытогоЧата, лАвтоПоложениеЧата, чГоризонтальноеПоложениеЧата, чВертикальноеПоложениеЧата, чИнтервалАвтоскрытия
	              2         2018.05.18  Добавлена лПолноценныйЧат
	              2         2018.06.12  Добавлена лМасштабироватьИзображение
	              2         2018.07.09  Удалена кЗаначка
	              2         2018.08.29  Добавлены лАвтоперенаправлениеРазрешено, лАвтоперенаправлениеЗамечено
	***/
	const ВЕРСИЯ_НАСТРОЕК = 2;

	const _амПредустановкиБуферизации = new Map(
	[
		[
			'J0126',
			{
				кОдновременныхЗагрузок: 1,
				чНачалоВоспроизведения: 3,
				чРазмерБуфера:          5,
				чРастягиваниеБуфера:    15,
				чИнтервалОпроса:        МИН_ИНТЕРВАЛ_ОБНОВЛЕНИЯ_СПИСКОВ
			}
		],
		[
			'J0127',
			{
				кОдновременныхЗагрузок: 2,
				чНачалоВоспроизведения: 3,   // 1..2 сегментов.
				чРазмерБуфера:          8.5, // 3..5 сегментов.
				чРастягиваниеБуфера:    20,
				чИнтервалОпроса:        АВТОНАСТРОЙКА
			}
		],
		[
			'J0128',
			{
				кОдновременныхЗагрузок: 2,
				чНачалоВоспроизведения: 17,
				чРазмерБуфера:          9.5,
				чРастягиваниеБуфера:    30,
				чИнтервалОпроса:        АВТОНАСТРОЙКА
			}
		]
	]);

	const _амПредустановкиОформления = new Map(
	[
		[
			'J0122',
			{
				сЦветФона:      '#282828',
				сЦветГрадиента: '#ffffff',
				сЦветКнопок:    '#d3be96',
				сЦветЗаголовка: '#cdbdec',
				сЦветВыделения: '#ff9428',
				чПрозрачность:  25
			}
		],
		[
			'J0121',
			{
				сЦветФона:      '#425e7b',
				сЦветГрадиента: '#ffffff',
				сЦветКнопок:    '#ffffff',
				сЦветЗаголовка: '#d1f0fa',
				сЦветВыделения: '#ffaa33',
				чПрозрачность:  30
			}
		],
		[
			'J0138',
			{
				сЦветФона:      '#4b4b4b',
				сЦветГрадиента: '#aaaaaa',
				сЦветКнопок:    '#bad4f8',
				сЦветЗаголовка: '#e2ebb4',
				сЦветВыделения: '#75a9f0',
				чПрозрачность:  5
			}
		],
		[
			'J0125',
			{
				сЦветФона:      '#161616',
				сЦветГрадиента: '#969696',
				сЦветКнопок:    '#f0f0f0',
				сЦветЗаголовка: '#b6c3c3',
				сЦветВыделения: '#6cb6ff',
				чПрозрачность:  10
			}
		]
	]);

	const _моМетаданныеПредустановок =
	[
		{
			амДанные:       _амПредустановкиБуферизации,
			сНастраиваемая: 'J0129',
			сВыбрана:       'сПредустановкаВыбрана_буферизация',
			сЗаполнена:     'лПредустановкаЗаполнена_буферизация',
			сСписок:        'предустановка-буферизация',
			сСобытие:       'настройки-измениласьпредустановка-буферизация'
		},
		{
			амДанные:       _амПредустановкиОформления,
			сНастраиваемая: 'J0123',
			сВыбрана:       'сПредустановкаВыбрана_оформление',
			сЗаполнена:     'лПредустановкаЗаполнена_оформление',
			сСписок:        'предустановка-оформление',
			сСобытие:       'настройки-измениласьпредустановка-оформление'
		}
	];

	const _мноПостоянныеНастройки = new Set(
	[
		'чВерсияНастроек',
		'чСлучайноеЧисло',
		'сПредыдущаяВерсия',
		'лАвтоперенаправлениеЗамечено'
	]);

	class Настройка
	{
		constructor(пНачальное, мпПеречисление, чМинимальное, чМаксимальное, сАвтонастройка)
		{
			this.пТекущее = undefined;
			this.пНачальное = пНачальное;
			this.мпПеречисление = мпПеречисление;
			this.чМинимальное = чМинимальное;
			this.чМаксимальное = чМаксимальное;
			this.сАвтонастройка = сАвтонастройка;
		}

		static Создать(пНачальное)
		{
			return new this(пНачальное, null, МИН_ЗНАЧЕНИЕ_НАСТРОЙКИ, МАКС_ЗНАЧЕНИЕ_НАСТРОЙКИ, '');
		}

		static СоздатьПеречисление(пНачальное, мпПеречисление)
		{
			return new this(пНачальное, мпПеречисление, МИН_ЗНАЧЕНИЕ_НАСТРОЙКИ, МАКС_ЗНАЧЕНИЕ_НАСТРОЙКИ, '');
		}

		static СоздатьДиапазон(пНачальное, чМинимальное, чМаксимальное, сАвтонастройка = '')
		{
			return new this(пНачальное, null, чМинимальное, чМаксимальное, сАвтонастройка);
		}

		static ПроверитьЗначение(пЗначение)
		// В отладочных данных и экспорте настройки хранятся в JSON.
		// Object и null в значениях запрещены.
		{
			Проверить(
				   пЗначение === пЗначение
				&& пЗначение !== Infinity
				&& пЗначение !== -Infinity
				&& пЗначение !== undefined
				&& typeof пЗначение !== 'function'
				&& typeof пЗначение !== 'symbol'
				&& typeof пЗначение !== 'object'
			);
		}

		ИсправитьЗначение(пЗначение)
		{
			Настройка.ПроверитьЗначение(пЗначение);
			Проверить(typeof пЗначение === typeof this.пНачальное);
			if (this.мпПеречисление)
			{
				if (!this.мпПеречисление.includes(пЗначение))
				{
					пЗначение = this.пНачальное;
				}
			}
			else if (typeof пЗначение === 'number')
			{
				if (пЗначение === АВТОНАСТРОЙКА)
				{
					if (this.сАвтонастройка === '')
					{
						пЗначение = this.пНачальное;
					}
				}
				else if (пЗначение < this.чМинимальное)
				{
					пЗначение = this.чМинимальное;
				}
				else if (пЗначение > this.чМаксимальное)
				{
					пЗначение = this.чМаксимальное;
				}
			}
			return пЗначение;
		}
	}

	const _оНастройки =
	{
		чВерсияНастроек:                     Настройка.Создать(ВЕРСИЯ_НАСТРОЕК), // Должна называться чВерсияНастроекTwitch5 для повышения надежности импорта.
		чСлучайноеЧисло:                     Настройка.Создать(Math.random()),
		сПредыдущаяВерсия:                   Настройка.Создать('2000.1.1'),
		чГромкость2:                         Настройка.СоздатьДиапазон(МАКСИМАЛЬНАЯ_ГРОМКОСТЬ / 2, МИНИМАЛЬНАЯ_ГРОМКОСТЬ, МАКСИМАЛЬНАЯ_ГРОМКОСТЬ), // Проценты.
		лПриглушить:                         Настройка.Создать(false),
		сНазваниеВарианта:                   Настройка.Создать('CoolCmd'),
		чДлительностьПовтора2:               Настройка.СоздатьДиапазон(60, МИН_ДЛИТЕЛЬНОСТЬ_ПОВТОРА, МАКС_ДЛИТЕЛЬНОСТЬ_ПОВТОРА, 'J0124'), // Секунды.
		лМасштабироватьИзображение:          Настройка.Создать(true),
		чСостояниеЧата:                      Настройка.СоздатьПеречисление(ЧАТ_ВЫГРУЖЕН, [ЧАТ_ВЫГРУЖЕН, ЧАТ_СКРЫТ, ЧАТ_ПАНЕЛЬ]),
		чСостояниеЗакрытогоЧата:             Настройка.СоздатьПеречисление(ЧАТ_ВЫГРУЖЕН, [ЧАТ_ВЫГРУЖЕН, ЧАТ_СКРЫТ]),
		лАвтоПоложениеЧата:                  Настройка.Создать(ЭТО_ПЛАНШЕТ),
		чГоризонтальноеПоложениеЧата:        Настройка.СоздатьПеречисление(ПРАВАЯ_СТОРОНА, [ПРАВАЯ_СТОРОНА, ЛЕВАЯ_СТОРОНА]),
		чВертикальноеПоложениеЧата:          Настройка.СоздатьПеречисление(НИЖНЯЯ_СТОРОНА, [ВЕРХНЯЯ_СТОРОНА, НИЖНЯЯ_СТОРОНА]),
		чПоложениеПанелиЧата:                Настройка.СоздатьПеречисление(ПРАВАЯ_СТОРОНА, [ВЕРХНЯЯ_СТОРОНА, ПРАВАЯ_СТОРОНА, НИЖНЯЯ_СТОРОНА, ЛЕВАЯ_СТОРОНА]),
		                                     // Минимальный размер задается в player.css.
		чШиринаПанелиЧата:                   Настройка.СоздатьДиапазон(340, 100, МАКС_ЗНАЧЕНИЕ_НАСТРОЙКИ), // CSS пикселы.
		                                     // Минимальный размер задается в player.css.
		                                     // Должна влезать покупка bits.
		чВысотаПанелиЧата:                   Настройка.СоздатьДиапазон(310, 100, МАКС_ЗНАЧЕНИЕ_НАСТРОЙКИ), // CSS пикселы.
		лПолноценныйЧат:                     Настройка.Создать(true),
		лЗатемнитьЧат:                       Настройка.Создать(false),
		чРазмерИнтерфейса:                   Настройка.СоздатьДиапазон(ЭТО_ПЛАНШЕТ ? 115 : 100, 75, 200),
		чИнтервалАвтоскрытия:                Настройка.СоздатьДиапазон(4, 0.5, 60),
		лАнимацияИнтерфейса:                 Настройка.Создать(!ЭТО_ПЛАНШЕТ),
		лМенятьГромкостьКолесом:             Настройка.Создать(true),
		чШагИзмененияГромкостиКолесом:       Настройка.СоздатьДиапазон(5, 1, 10), // Проценты.
		лПоказатьСтатистику:                 Настройка.Создать(false),
		//
		// Предустановки буферизации.
		//
		сПредустановкаВыбрана_буферизация:   Настройка.Создать('J0127'),
		лПредустановкаЗаполнена_буферизация: Настройка.Создать(false),
		кОдновременныхЗагрузок:              Настройка.СоздатьДиапазон(0, 1, 3), // Сегменты.
		                                     // TODO Измерять в сегментах?
		чНачалоВоспроизведения:              Настройка.СоздатьДиапазон(0, МИН_РАЗМЕР_БУФЕРА, МАКС_РАЗМЕР_БУФЕРА), // Секунды.
		                                     // TODO Измерять в сегментах?
		                                     // TODO Добавить зависимость от кОдновременныхЗагрузок?
		                                     // TODO Можно сделать 2 значения и постепенный рост с первого до второго.
		чРазмерБуфера:                       Настройка.СоздатьДиапазон(0, МИН_РАЗМЕР_БУФЕРА, МАКС_РАЗМЕР_БУФЕРА), // Секунды.
		                                     // TODO Измерять в сегментах?
		чРастягиваниеБуфера:                 Настройка.СоздатьДиапазон(0, МИН_РАСТЯГИВАНИЕ_БУФЕРА, МАКС_РАСТЯГИВАНИЕ_БУФЕРА), // Секунды.
		чИнтервалОпроса:                     Настройка.СоздатьДиапазон(0, МИН_ИНТЕРВАЛ_ОБНОВЛЕНИЯ_СПИСКОВ, 250, 'J0120'), // Проценты.
		//
		// Предустановки оформления.
		//
		сПредустановкаВыбрана_оформление:    Настройка.Создать('J0122'),
		лПредустановкаЗаполнена_оформление:  Настройка.Создать(false),
		сЦветФона:                           Настройка.Создать(''),
		сЦветГрадиента:                      Настройка.Создать('#ffffff'),
		сЦветКнопок:                         Настройка.Создать(''),
		сЦветЗаголовка:                      Настройка.Создать(''),
		сЦветВыделения:                      Настройка.Создать(''),
		чПрозрачность:                       Настройка.СоздатьДиапазон(0, 0, 80),
		//
		// Content script.
		//
		лАвтоперенаправлениеРазрешено:       Настройка.Создать(true),
		лАвтоперенаправлениеЗамечено:        Настройка.Создать(false)
	};
	
	// Не увеличивать слишком сильно, чтобы новая вкладка с проигрывателем не подхватила старые настройки.
	// Firefox во время обновления расширения удаляет content script без возможности завершить отложенное сохранение.
	const ОТКЛАДЫВАТЬ_СОХРАНЕНИЕ_НА = ЭТО_CONTENT_SCRIPT ? 50 : 500; // Миллисекунды.
	let _чТаймерОтложенногоСохранения = 0;
	let _оОтложенноеСохранение = null;
	let _лОтложенноеУдаление = false;

	let _обВосстановить = null;

	function Восстановить()
	{
		const обВосстановить = _обВосстановить;
		_обВосстановить = null;
		return обВосстановить;
	}

	function НачатьВосстановление()
	{
		м_Журнал.Вот('[Настройки] Восстанавливаю настройки');
		_обВосстановить = new Promise((фВыполнить, фОтказаться) =>
		{
			chrome.storage.local.get(null, оВосстановленныеНастройки =>
			{
				if (г_лРаботаЗавершена)
				{
					return;
				}
				try
				{
					if (chrome.runtime.lastError)
					{
						console.error(chrome.runtime.lastError.message);
						м_Отладка.ЗавершитьРаботуИПоказатьСообщение('J0209');
					}
					else
					{
						м_Журнал.Вот(`[Настройки] Настройки прочитаны из хранилища: ${м_Журнал.O(оВосстановленныеНастройки)}`);
						ЗавершитьВосстановление(оВосстановленныеНастройки);
						фВыполнить();
					}
				}
				catch (пИсключение)
				{
					фОтказаться(пИсключение);
				}
			});
		});
	}

	function ЗавершитьВосстановление(оВосстановленныеНастройки)
	{
		Проверить(ЭтоОбъект(оВосстановленныеНастройки));
		Проверить(!_оНастройки.чВерсияНастроек.пТекущее);

		const оСохранить = {};
		const лОстальноеУдалить = ПроверитьВерсиюНастроек(оВосстановленныеНастройки, оСохранить);

		// Не переносим устаревшие настройки, добавляем новые, добавляем и сохраняем постоянные и исправленные.
		for (let сИмя of Object.keys(_оНастройки))
		{
			if (оВосстановленныеНастройки.hasOwnProperty(сИмя))
			{
				const пЗначение = _оНастройки[сИмя].ИсправитьЗначение(оВосстановленныеНастройки[сИмя]);
				if (пЗначение !== оВосстановленныеНастройки[сИмя])
				{
					оСохранить[сИмя] = пЗначение;
				}
				_оНастройки[сИмя].пТекущее = пЗначение;
			}
			else
			{
				if (_мноПостоянныеНастройки.has(сИмя))
				{
					оСохранить[сИмя] = _оНастройки[сИмя].пНачальное;
				}
				_оНастройки[сИмя].пТекущее = _оНастройки[сИмя].пНачальное;
			}
		}

		НачатьСохранение(оСохранить, лОстальноеУдалить);
	}

	function ПроверитьВерсиюНастроек(оНастройки, оСохранить)
	// оНастройки и оСохранить могут указывать на один объект, если информация в оСохранить не нужна.
	// Возвращает true если нужно очистить хранилище расширения. Для импорта это означает, что
	// в импортируемом файле настроек не обнаружено.
	{
		// Первый запуск расширения после установки, ранняя версия расширения без чВерсияНастроек,
		// несовместимая версия настроек, импорт непонятно чего?
		if (!Number.isInteger(оНастройки.чВерсияНастроек) || оНастройки.чВерсияНастроек < 1 || оНастройки.чВерсияНастроек > ВЕРСИЯ_НАСТРОЕК)
		{
			for (let сИмя of Object.keys(оНастройки))
			{
				delete оНастройки[сИмя];
			}
			return true;
		}

		// Проверить имена выбранных предустановок. С этой проверкой добавлять и удалять предустановки
		// можно не изменяя ВЕРСИЯ_НАСТРОЕК.
		for (let оМетаданные of _моМетаданныеПредустановок)
		{
			let сИмя = оНастройки[оМетаданные.сВыбрана];
			if (сИмя !== undefined && сИмя !== оМетаданные.сНастраиваемая)
			{
				for (let сИмяПредустановки of оМетаданные.амДанные.keys())
				{
					if (сИмя === сИмяПредустановки)
					{
						сИмя = undefined;
						break;
					}
				}
				if (сИмя !== undefined)
				{
					оСохранить[оМетаданные.сВыбрана] = оНастройки[оМетаданные.сВыбрана] = _оНастройки[оМетаданные.сВыбрана].пНачальное;
				}
			}
		}

		// В ранних версиях не было настройки чСостояниеЗакрытогоЧата.
		if (оНастройки.чСостояниеЗакрытогоЧата !== оНастройки.чСостояниеЧата
		&& (оНастройки.чСостояниеЧата === ЧАТ_ВЫГРУЖЕН || оНастройки.чСостояниеЧата === ЧАТ_СКРЫТ))
		{
			оСохранить.чСостояниеЗакрытогоЧата = оНастройки.чСостояниеЗакрытогоЧата = оНастройки.чСостояниеЧата;
		}

		if (оНастройки.чВерсияНастроек === ВЕРСИЯ_НАСТРОЕК)
		{
			return false;
		}

		// Сюда можно добавить преобразование настроек старых версий.

		оСохранить.чВерсияНастроек = оНастройки.чВерсияНастроек = ВЕРСИЯ_НАСТРОЕК;
		return false;
	}

	function НачатьСохранение(оСохранить, лОстальноеУдалить)
	// Функция не позволяет сбрасывать настройки на диск слишком часто. Например, громкость может изменяться каждую миллисекунду.
	// Также функция объединяет последовательность вызовов Изменить() в одну атомарную операцию сохранения.
	// Меняет оСохранить.
	{
		Проверить(ЭтоОбъект(оСохранить));
		if (Object.keys(оСохранить).length !== 0 || лОстальноеУдалить)
		{
			if (_чТаймерОтложенногоСохранения === 0)
			{
				м_Журнал.Вот(`[Настройки] Откладываю сохранение настроек на ${ОТКЛАДЫВАТЬ_СОХРАНЕНИЕ_НА}мс`);
				_оОтложенноеСохранение = оСохранить;
				_лОтложенноеУдаление = лОстальноеУдалить;
				_чТаймерОтложенногоСохранения = setTimeout(ДобавитьОбработчикИсключений(ЗавершитьСохранение), ОТКЛАДЫВАТЬ_СОХРАНЕНИЕ_НА);
			}
			else if (лОстальноеУдалить)
			{
				_оОтложенноеСохранение = оСохранить;
				_лОтложенноеУдаление = лОстальноеУдалить;
			}
			else
			{
				Object.assign(_оОтложенноеСохранение, оСохранить);
			}
		}
	}

	function ЗавершитьСохранение()
	{
		м_Журнал.Вот('[Настройки] Завершаю отложенное сохранение');
		Проверить(_чТаймерОтложенногоСохранения !== 0);
		_чТаймерОтложенногоСохранения = 0;
		Проверить(ЭтоОбъект(_оОтложенноеСохранение));
		Сохранить(_оОтложенноеСохранение, _лОтложенноеУдаление);
		// Освободить память.
		_оОтложенноеСохранение = null;
	}

	function Сохранить(оСохранить, лОстальноеУдалить)
	{
		if (лОстальноеУдалить)
		{
			chrome.storage.local.clear(ПроверитьРезультатСохранения);
			м_Журнал.Вот('[Настройки] Все настройки удалены из хранилища');
		}
		chrome.storage.local.set(оСохранить, ПроверитьРезультатСохранения);
		м_Журнал.Вот(`[Настройки] Настройки записаны в хранилище: ${м_Журнал.O(оСохранить)}`);
	}

	function ПроверитьРезультатСохранения()
	{
		if (chrome.runtime.lastError)
		{
			console.error(chrome.runtime.lastError.message);
			м_Отладка.ЗавершитьРаботуИПоказатьСообщение('J0212');
		}
	}

	function Сбросить()
	{
		м_Журнал.Окак('[Настройки] Сбрасываю настройки');

		const оСохранить = {};
		for (let сИмя of _мноПостоянныеНастройки)
		{
			оСохранить[сИмя] = _оНастройки[сИмя].пТекущее;
		}

		НачатьСохранение(оСохранить, true);
		window.location.reload();
	}

	function Экспорт()
	{
		м_Журнал.Окак('[Настройки] Экспортирую настройки');
		Проверить(_оНастройки.чВерсияНастроек.пТекущее);
		
		const оЭкспорт =
		{
			чВерсияНастроек: ВЕРСИЯ_НАСТРОЕК
		};
		for (let сИмя of Object.keys(_оНастройки))
		{
			// Экспортируемые настройки могут попасть на другой компьютер, поэтому постоянные настойки пропускаем.
			if (!_мноПостоянныеНастройки.has(сИмя))
			{
				оЭкспорт[сИмя] = _оНастройки[сИмя].пТекущее;
			}
		}
		м_Журнал.Вот(`[Настройки] Отобраны настройки для экспорта: ${м_Журнал.O(оЭкспорт)}`);

		ЗаписатьТекстВЛокальныйФайл(JSON.stringify(оЭкспорт), 'application/json', Текст('J0133'));
	}

	function Импорт(оИзФайла)
	{
		м_Журнал.Окак(`[Настройки] Импортирую настройки из файла ${оИзФайла.name}`);
		Проверить(_оНастройки.чВерсияНастроек.пТекущее);

		if (оИзФайла.size === 0 || оИзФайла.size > 10000)
		{
			м_Журнал.Ой(`[Настройки] Размер файла: ${оИзФайла.size}`);
			alert(Текст('J0134'));
			return;
		}

		const оЧиталка = new FileReader();
		оЧиталка.addEventListener('loadend', ДобавитьОбработчикИсключений(() =>
		{
			if (!ЭтоНепустаяСтрока(оЧиталка.result))
			{
				м_Журнал.Ой(`[Настройки] Результат чтения файла: ${оЧиталка.result}`);
				alert(Текст('J0135') + оИзФайла.name);
				return;
			}
			м_Журнал.Вот(`[Настройки] Настройки прочитаны из файла: ${оЧиталка.result}`);

			let оСохранить;

			try
			{
				оСохранить = JSON.parse(оЧиталка.result);
				if (!ЭтоОбъект(оСохранить))
				{
					throw 1;
				}

				if (ПроверитьВерсиюНастроек(оСохранить, оСохранить))
				{
					throw 2;
				}

				for (let сИмя of Object.keys(оСохранить))
				{
					if (!_оНастройки.hasOwnProperty(сИмя))
					{
						delete оСохранить[сИмя];
					}
					else
					{
						оСохранить[сИмя] = _оНастройки[сИмя].ИсправитьЗначение(оСохранить[сИмя]);
						if (оСохранить[сИмя] === _оНастройки[сИмя].пНачальное)
						{
							delete оСохранить[сИмя];
						}
					}
				}
			}
			catch (пИсключение)
			{
				м_Журнал.Ой(`[Настройки] Поймано исключение во время разбора настроек: ${пИсключение}`);
				alert(Текст('J0134'));
				return;
			}

			for (let сИмя of _мноПостоянныеНастройки)
			{
				оСохранить[сИмя] = _оНастройки[сИмя].пТекущее;
			}

			НачатьСохранение(оСохранить, true);
			window.location.reload();
		}));
		оЧиталка.readAsText(оИзФайла);
	}

	function Получить2(сИмя)
	{
		Проверить(typeof сИмя === 'string');
		Проверить(_оНастройки.hasOwnProperty(сИмя));
		for (let оМетаданные of _моМетаданныеПредустановок)
		{
			const оПредустановка = оМетаданные.амДанные.get(_оНастройки[оМетаданные.сВыбрана].пТекущее);
			if (оПредустановка)
			{
				const пЗначение = оПредустановка[сИмя];
				if (пЗначение !== undefined)
				{
					return пЗначение;
				}
			}
		}
		return _оНастройки[сИмя].пТекущее;
	}

	function Получить(сИмя)
	{
		// Если чНачалоВоспроизведения > чРазмерБуфера, то чРазмерБуфера по-прежнему используется для загрузки сегментов,
		// а размер буфера проигрывателя равен чНачалоВоспроизведения. Возможно, в будущем имеет смысл разнести размеры
		// для загрузки и воспроизведения по разным настройкам.
		if (сИмя === 'чМаксРазмерБуфера')
		{
			return Math.max(Получить2('чНачалоВоспроизведения'), Получить2('чРазмерБуфера'));
		}
		return Получить2(сИмя);
	}

	function Изменить(сИмя, пЗначение, лНеСохранять = false)
	{
		Проверить(typeof сИмя === 'string');
		Проверить(_оНастройки[сИмя].ИсправитьЗначение(пЗначение) === пЗначение);
		const оСохранить = {};

		for (let оМетаданные of _моМетаданныеПредустановок)
		{
			const оПредустановка = оМетаданные.амДанные.get(_оНастройки[оМетаданные.сВыбрана].пТекущее);
			if (оПредустановка && оПредустановка.hasOwnProperty(сИмя))
			{
				if (пЗначение === оПредустановка[сИмя])
				{
					return;
				}
				// Такой вариант пока не использовался и не тестировался.
				Проверить(!лНеСохранять);
				оСохранить[оМетаданные.сВыбрана  ] = _оНастройки[оМетаданные.сВыбрана  ].пТекущее = оМетаданные.сНастраиваемая;
				оСохранить[оМетаданные.сЗаполнена] = _оНастройки[оМетаданные.сЗаполнена].пТекущее = true;
				for (let сИмяПредустановки of Object.keys(оПредустановка))
				{
					оСохранить[сИмяПредустановки] = _оНастройки[сИмяПредустановки].пТекущее = оПредустановка[сИмяПредустановки];
				}
				ОбновитьСписокПредустановок(оМетаданные);
				// м_События.ПослатьСобытие() вызывать не нужно.
				break;
			}
		}

		if (_оНастройки[сИмя].пТекущее !== пЗначение)
		{
			оСохранить[сИмя] = _оНастройки[сИмя].пТекущее = пЗначение;
		}

		if (!лНеСохранять)
		{
			НачатьСохранение(оСохранить, false);
		}
	}

	function ОбновитьСписокПредустановок(оМетаданные)
	{
		const узСписок = Узел(оМетаданные.сСписок);
		узСписок.length = 0;
		const сВыбрать = _оНастройки[оМетаданные.сВыбрана].пТекущее;
		for (let сИмя of оМетаданные.амДанные.keys())
		{
			узСписок.add(new Option(Текст(сИмя), сИмя, сИмя === сВыбрать, сИмя === сВыбрать));
		}
		if (_оНастройки[оМетаданные.сЗаполнена].пТекущее)
		{
			узСписок.add(new Option(Текст(оМетаданные.сНастраиваемая), оМетаданные.сНастраиваемая, оМетаданные.сНастраиваемая === сВыбрать, оМетаданные.сНастраиваемая === сВыбрать));
		}
		Проверить(узСписок.value);
		return узСписок;
	}

	const ОбработатьИзменениеПредустановки = ДобавитьОбработчикИсключений(оСобытие =>
	{
		for (let оМетаданные of _моМетаданныеПредустановок)
		{
			if (оМетаданные.сСписок === оСобытие.target.id)
			{
				Проверить(оСобытие.target.value);
				Изменить(оМетаданные.сВыбрана, оСобытие.target.value);
				м_События.ПослатьСобытие(оМетаданные.сСобытие);
				return;
			}
		}
		Проверить(false);
	});

	function НастроитьСпискиПредустановок()
	// Вызвать один раз.
	{
		for (let оМетаданные of _моМетаданныеПредустановок)
		{
			ОбновитьСписокПредустановок(оМетаданные)
			.addEventListener('change', ОбработатьИзменениеПредустановки);
		}
	}

	function ПолучитьПараметрыНастройки(сИмя)
	// TODO По хорошему, в возвращаемом объекте не должно быть свойства пТекущее, или оно должно быть только для чтения.
	{
		Проверить(typeof сИмя === 'string');
		Проверить(_оНастройки.hasOwnProperty(сИмя));
		return _оНастройки[сИмя];
	}

	function ПолучитьДанныеДляОтчета()
	{
		const оОтчет = {};
		for (let сИмя of Object.keys(_оНастройки))
		{
			if (_мноПостоянныеНастройки.has(сИмя) || _оНастройки[сИмя].пТекущее !== _оНастройки[сИмя].пНачальное)
			{
				оОтчет[сИмя] = _оНастройки[сИмя].пТекущее;
			}
		}
		return оОтчет;
	}

	window.addEventListener('beforeunload', () =>
	// Восстановление настроек может быть еще не завершено.
	// Уже могла быть вызвана ЗавершитьРаботу(), поэтому нельзя использовать ДобавитьОбработчикИсключений().
	{
		if (_чТаймерОтложенногоСохранения !== 0)
		{
			clearTimeout(_чТаймерОтложенногоСохранения);
			ЗавершитьСохранение();
		}
	});

	// Восстанавливаем настройки пока загружаются другие модули.
	НачатьВосстановление();

	return {
		Восстановить, Сбросить,
		Экспорт, Импорт,
		Получить, Изменить,
		ПолучитьПараметрыНастройки,
		НастроитьСпискиПредустановок,
		ПолучитьДанныеДляОтчета
	};
})();

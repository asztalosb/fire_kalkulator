const FORM_DEFAULTS = {
  CURRENT_SAVINGS: 0,
  EXPECTED_INTEREST: 8,
  EXPECTED_INFLATION: 4,
  MONTHLY_SAVINGS: 100000,
  SWR: 4.5,
  EXTRA_MONTHLY_INCOME: 0
}
const DEFAULT_TABLE_YEARS = 10;

const DEFAULT_LANGUAGE = "en";
const AVAILABLE_LANGUAGES = ['en', 'hu'];
const TRANSLATIONS = {};

let fireApp = new Moon({
  el: '#fireapp',
  data: {
    labels: {},
    currentLanguage: DEFAULT_LANGUAGE,

    currentSavings: FORM_DEFAULTS.CURRENT_SAVINGS,
    expectedInterest: FORM_DEFAULTS.EXPECTED_INTEREST,
    expectedInflation: FORM_DEFAULTS.EXPECTED_INFLATION,
    monthlySavings: FORM_DEFAULTS.MONTHLY_SAVINGS,
    swr: FORM_DEFAULTS.SWR,
    extraMonthlyIncome: FORM_DEFAULTS.EXTRA_MONTHLY_INCOME,

    yearsToLoad: DEFAULT_TABLE_YEARS,
    profiles: [],
    currentProfile: undefined,
  },
  hooks: {
    init: async function () {
      // Load translations
      for (const language of AVAILABLE_LANGUAGES) {
        await fetch(`./js/lang/${language}.json`)
        .then(res => res.json())
        .then(data => {
          TRANSLATIONS[language] = data;
        });
      }
      var browserLanguage = navigator.languages?.[0]?.substring(0,2) ?? navigator.language?.substring(0,2);
      this.callMethod('setLanguage', [AVAILABLE_LANGUAGES.indexOf(browserLanguage) != -1 ? browserLanguage : DEFAULT_LANGUAGE]);

      // Load saved profiles
      const profiles = JSON.parse(localStorage.getItem("fireProfiles") || "[]");
      this.set("profiles", profiles);

      if (profiles.length > 0) {
        // Select the first profile by default
        const first = profiles[0].name;
        this.callMethod("selectProfile", [first]);
      } else {
        // No profiles saved yet
        this.set("currentProfile", undefined);
      }
    }

  },
  methods: {
    setLanguage: function (newLanguage) {
      this.set("labels", TRANSLATIONS[newLanguage]);
      this.set("currentLanguage", newLanguage);
    },
    t: function (label) {
      return this.get("labels")?.[label];
    },
    selectProfile: function (pn) {
      const profileName = pn?.target?.value ?? pn;
      if(!profileName) {
        this.set("currentProfile", undefined);
        return;
      }
      
      const profiles = JSON.parse(localStorage.getItem("fireProfiles") || "[]");
      const profile = profiles.find(p => p.name === profileName);

      if (!profile) {
        alert("Error loading profile.");
        return;
      }

      this.set("currentSavings", profile.currentSavings);
      this.set("expectedInterest", profile.expectedInterest);
      this.set("expectedInflation", profile.expectedInflation);
      this.set("monthlySavings", profile.monthlySavings);
      this.set("swr", profile.swr);
      this.set("extraMonthlyIncome", profile.extraMonthlyIncome);

      let self = this;
      Moon.nextTick(function() {
        self.set("currentProfile", profile.name);
      });
    },

    saveProfile: function () {
      const name = prompt("Profile name:", this.get("currentProfile") || "");
      if (!name?.trim()) return;

      const profiles = JSON.parse(localStorage.getItem("fireProfiles") || "[]");

      const newProfile = {
        name,
        currentSavings: this.get("currentSavings"),
        expectedInterest: this.get("expectedInterest"),
        expectedInflation: this.get("expectedInflation"),
        monthlySavings: this.get("monthlySavings"),
        swr: this.get("swr"),
        extraMonthlyIncome: this.get("extraMonthlyIncome")
      };

      const existingIndex = profiles.findIndex(p => p.name === name);
      if (existingIndex >= 0) profiles[existingIndex] = newProfile;
      else profiles.push(newProfile);

      localStorage.setItem("fireProfiles", JSON.stringify(profiles));

      this.set("profiles", profiles);
      this.callMethod("selectProfile", [name]);
    },

    deleteProfile: function () {
      const name = this.get("currentProfile");
      if (!name) {
        alert("No profile selected.");
        return;
      }

      if (!confirm(`Delete profile "${name}"?`)) return;

      let profiles = JSON.parse(localStorage.getItem("fireProfiles") || "[]");
      profiles = profiles.filter(p => p.name !== name);

      localStorage.setItem("fireProfiles", JSON.stringify(profiles));

      this.set("profiles", profiles);
      
      this.callMethod("selectProfile", [profiles?.[0]?.name ?? undefined]);
    },

    loadJsonConfig: function () {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";

      input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = event => {
          try {
            const data = JSON.parse(event.target.result);

            if (!Array.isArray(data)) {
              alert("Invalid JSON format.");
              return;
            }

            localStorage.setItem("fireProfiles", JSON.stringify(data));
            this.set("profiles", data);
            
            this.callMethod("selectProfile", [data?.[0]?.name ?? undefined]);

            alert("Profiles imported.");
          } catch (err) {
            alert("Invalid JSON file.");
          }
        };

        reader.readAsText(file);
      };

      input.click();
    },

    saveJsonConfig: function () {
      const profiles = JSON.parse(localStorage.getItem("fireProfiles") || "[]");
      const blob = new Blob([JSON.stringify(profiles, null, 2)], { type: "application/json" });

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "fire_profiles.json";
      a.click();

      URL.revokeObjectURL(a.href);
    },

    yearsData: function (range) {
      const inflationCorrection = (amount, years) =>
        amount * Math.pow(1 - this.get('expectedInflation') / 100, years);
      const compoundInterestByYear = (amount, years) =>
        amount * Math.pow(1 + this.get('expectedInterest') / 100, years);

      const formatValue = value => Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 }).format(value);

      return Array.from({length: range}, (_, i) => {
        const year = new Date().getFullYear() + i;

        const yearlySavings = 12 * +this.get('monthlySavings');

        let openingBalance =  compoundInterestByYear(+this.get('currentSavings'), i);
        for (let j = 0; j < i; j++) {
          openingBalance += compoundInterestByYear(yearlySavings, j);
        }
          
        const yearlyYields = openingBalance * +this.get('expectedInterest') / 100;
        const endYearMin = openingBalance + yearlySavings + yearlyYields;
        const endYearMinPV = inflationCorrection(endYearMin, i);
        const monthlyFire = endYearMin * +this.get('swr') / 100 / 12;
        const monthlyFirePV = inflationCorrection(monthlyFire, i);
        const totalMonthly = monthlyFire + +this.get('extraMonthlyIncome');
        const totalMonthlyPV = inflationCorrection(totalMonthly, i);

        return {
          year,
          openingBalance: formatValue(openingBalance),
          yearlySavings: formatValue(yearlySavings),
          yearlyYields: formatValue(yearlyYields),
          endYearMin: formatValue(endYearMin),
          endYearMinPV: formatValue(endYearMinPV),
          monthlyFire: formatValue(monthlyFire),
          monthlyFirePV: formatValue(monthlyFirePV),
          totalMonthly: formatValue(totalMonthly),
          totalMonthlyPV: formatValue(totalMonthlyPV)
        };
      });
    },

    loadMoreYears: function () {
      this.set('yearsToLoad', this.get('yearsToLoad') + 5);
    }
  }
});

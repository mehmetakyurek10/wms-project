const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  { ignores: ["node_modules/**", "coverage/**"] },

  js.configs.recommended,

  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "commonjs",
      globals: globals.node,
    },
    rules: {
      // Kullanilmayan degiskenler hata. Bilerek birakilanlar icin alt cizgi
      // on eki bir kacis yolu: hataYonetici'nin dorduncu parametresi gibi.
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Icinde hic await olmayan async fonksiyon: ya await unutulmus ya da
      // async gereksiz. Ikisi de duzeltilmeli.
      "require-await": "error",

      // == yerine === . null karsilastirmasi disarida, cunku "x == null"
      // hem null hem undefined yakalamak icin bilerek kullanilan bir kalip.
      eqeqeq: ["error", "always", { null: "ignore" }],

      "prefer-const": "error",
      "no-var": "error",

      // Sonucu kullanilmayan ifadeler: "res.json" yerine "res.json()" gibi
      // cagirma unutmalarini yakalar.
      "no-unused-expressions": "error",

      "no-console": "error",
    },
  },

  {
    files: ["config/env.js", "db/**/*.js"],
    rules: {
      "no-console": "off",
    },
  },
];

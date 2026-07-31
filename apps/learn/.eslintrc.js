// eslint-disable-next-line no-undef
module.exports = {
    env: {
        browser: true,
        es2021: true,
    },
    extends: ['next/core-web-vitals', 'prettier', 'eslint:recommended', 'plugin:react/recommended', 'plugin:@typescript-eslint/recommended'],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
        },
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    plugins: ['react', 'react-hooks', '@typescript-eslint'],
    settings: {
        react: {
            version: 'detect',
        },
    },
    rules: {
        'react/react-in-jsx-scope': 'off',
        'no-unused-vars': 'warn',
        'no-console': [
            'warn',
            {
                allow: ['error'],
            },
        ],
    },
}

# Registro anterior à Proposta 3 do frontend

Data: 25 de agosto de 2026

Escopo: frontend do Cinevault

Objetivo: criar um ponto de retorno verificável antes da implementação visual da proposta 3, sem alterar o backend.

## Estado funcional

- Jest: 1 suíte aprovada, 3 testes aprovados.
- Playwright: 6 testes aprovados (desktop Chromium e mobile Chromium).
- Fluxos cobertos pelo Playwright: login, navegação, filtros, busca e Minha lista.
- O diretório de trabalho não possui metadados Git disponíveis; por isso, o registro usa hashes SHA-256.

## Integridade do backend

- Arquivos considerados: 102, excluindo `node_modules`, `dist` e `coverage`.
- SHA-256 agregado: `6865E222C038D56F4D931547BCA9719B0115DB27B12917E6CF062330E84318D7`.

## Hashes do frontend

| Arquivo | SHA-256 |
| --- | --- |
| `frontend/src/App.tsx` | `C4A6220DA4FD6895DA4F93510185C8544740A81461AE877ABF677D6CB895944C` |
| `frontend/src/product.css` | `A9B0BD2F25646F1B4CFE7FA91C2F0334B76DB5116C09446CEDF57A3BEB8ACD4E` |
| `frontend/src/styles.css` | `730417B54C2CA7E932E03D45E2655B752A00DFE39B8D5818EEFDEF44691AFD2E` |
| `frontend/src/main.tsx` | `02D453D01DED179747C25075C0B3553E575AF7CE371D543E76C8466AE7536C23` |
| `frontend/src/LoginPage.tsx` | `320AB18E56D877B120FCD2DB3629CE0A81A3D4992D9A17C179EE663E084CD10C` |
| `frontend/src/ProfilePage.tsx` | `628C060E4D659E9A92D0908A1F85ED6DBD60E86C52DF627CE45F8A8BBF6501A7` |
| `frontend/src/AdminPage.tsx` | `55491CAC4072A4893AE262640A9F78C91830529C4DEC978B2C7B68611EEC1528` |
| `frontend/src/PlaybackPlayer.tsx` | `4AE041F4346B60B55DE2BF30B954E6ACA29D0AA329C5A487CD541C0F9C39402B` |
| `frontend/src/AuthContext.tsx` | `7763BF8922656C42A2A9799E7667D4D991DD7EE01605FA715C3FAB11E6D2B6DC` |
| `frontend/src/RegistrationPage.tsx` | `5ABD54E84007920EADAA46208CF96766611D0D54D23568AEF2C53159608E3B5E` |
| `frontend/src/MediaUploadPanel.tsx` | `7F33E7F50EDAB57C436046F1BBAD611FC97330E9194F4F9B8ECDE626FBE38354` |
| `frontend/src/NotificationCenter.tsx` | `988153C18C944C7A5A949B69CA656CADBB2AD85805B0023EAA4431A98B608571` |
| `frontend/index.html` | `320E52531AE509B5343755AC94BBE95C09CAC011310CB3C1DB2DD99637A9B607` |
| `frontend/package.json` | `FE68139B7CDE5ADAAF06E8E2F62ABAC8E0E99DA35322CB8AE4AE3E105A2BC4FE` |
| `frontend/playwright.config.ts` | `B3AF331CD07EAEAED39A5C3A20E1B5185C87CFC30E15C9408E1F2D9A8B352D92` |
| `frontend/e2e/catalog.spec.ts` | `F07F620D5C63A04D3AED091FB82B88A09DDC1C36E5BD2BB894C090862B4DCC7E` |

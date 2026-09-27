# Plano de implementacao

## Fase 1 - Fundacao e contratos

- [x] Configurar o monorepo com npm workspaces.
- [x] Criar contratos compartilhados para perfil, catalogo e playback.
- [x] Expor as rotas `GET /api/v1/web/browse` e `GET /api/v1/web/playback/auth`.
- [x] Isolar integracoes centrais por interfaces.
- [x] Adicionar testes automatizados das rotas e contratos.

## Fase 2 - Cliente React

- [x] Criar aplicacao React/TypeScript.
- [x] Implementar Login, Browse e Watch.
- [x] Implementar Billboard, Row e Card.
- [x] Criar AuthContext e sessao de playback autorizada.
- [x] Integrar login, sessao em memoria e catalogo protegido com o BFF.
- [x] Criar painel administrativo inicial de catalogo.

## Fase 3 - Seguranca

- [x] Access token JWT de 15 minutos mantido apenas em memoria.
- [x] Refresh token opaco de 30 dias em cookie HttpOnly, Secure em producao e SameSite=Strict.
- [ ] Silent refresh com fila de requisicoes e rotacao de refresh token.
- [ ] Validacao de entrada, CORS restritivo, headers de seguranca e protecao CSRF.

### Estado da autenticacao

- [x] Senhas derivadas com scrypt e comparacao resistente a timing attack.
- [x] Refresh tokens armazenados somente como SHA-256 e rotacionados atomicamente.
- [x] Repositorios intercambiaveis em memoria e PostgreSQL.
- [x] Migracao e seed reproduziveis via npm.
- [x] Testes de login, autorizacao, rotacao e replay de refresh token.
- [x] Cadastro por link de email de uso unico com expiracao de 30 minutos.
- [x] Criacao transacional de usuario e perfil apos definicao da senha.
- [x] Tela de cadastro, confirmacao, senha e retorno ao login em cinco segundos.
- [ ] Configurar um provedor SMTP real e validar entregabilidade, SPF, DKIM e DMARC.

## Fase 4 - Dados e resiliencia

- [x] Cache-aside por interface, com TTL, invalidacao do catalogo e protecao contra cache stampede.
- [ ] Adaptador Redis e invalidacao distribuida para multiplas instancias do BFF.
- [ ] Persistir progresso no Cassandra usando a chave definida no manual.
- [ ] Circuit breaker com fallback de catalogo popular.
- [ ] Observabilidade, health checks e telemetria do player.

## Fase 5 - Catalogo e administracao

- [x] Persistir filmes e series no PostgreSQL.
- [x] Adicionar funcoes `ADMIN` e `USER` ao modelo de acesso.
- [x] Proteger APIs administrativas com JWT e autorizacao por funcao.
- [x] Criar, publicar e arquivar titulos pelo painel.
- [x] Exibir somente titulos publicados no catalogo do cliente.
- [x] Editar titulos existentes no painel.
- [x] Modelar generos e associacao muitos-para-muitos com titulos.
- [x] Modelar temporadas e episodios com gerenciamento administrativo.
- [x] Exibir detalhes publicos, seletor de episodios e player HLS.
- [x] Implementar upload local de arquivos fonte e transcodificacao HLS com FFmpeg.
- [x] Separar trailer e conteudo principal no armazenamento e no painel.
- [x] Gerar HLS adaptativo em 360p, 720p e 1080p.
- [x] Adicionar armazenamento de objetos S3 compativel com fallback local.
- [x] Entregar playlists e segmentos por URLs HMAC assinadas e prontas para CDN.
- [ ] Provisionar o bucket e a distribuicao CDN do ambiente de producao.

## Decisoes iniciais

As respostas locais da Fase 1 sao fixtures de desenvolvimento, nao simulacoes espalhadas pelos controladores. Elas implementam interfaces de servico e podem ser trocadas por conectores reais sem alterar os contratos HTTP.

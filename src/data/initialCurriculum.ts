import { BrainstormIdea, BridgeSuggestion, TrainingModule } from '../types/training';

export const INITIAL_MODULES: TrainingModule[] = [
  {
    id: 'mod-setup',
    title: 'Setup do Ambiente Oracle 18c XE, Users, Grants e TNSNAMES.ora',
    shortTitle: 'Setup, Users & Grants',
    durationMinutes: 15,
    category: 'Administração Inicial',
    completed: false,
    conceptSummary:
      'No Oracle, um Usuário (USER) equivale diretamente a um Schema (conjunto próprio de tabelas, views e rotinas). No Oracle 18c XE, a arquitetura Multitenant exige conectar-se ao Pluggable Database (XEPDB1) para criar usuários de negócio, definindo cota de armazenamento na tablespace e privilégios granulares via GRANT, além de configurar a resolução de rede via tnsnames.ora.',
    keyPoints: [
      {
        title: 'Conexão no Serviço XEPDB1 (Oracle 18c XE)',
        pathOrSyntax: 'localhost:1521/XEPDB1 (Pluggable Database)',
        detail:
          'Conecte no serviço XEPDB1 como SYSTEM para criar usuários de aplicação sem erro ORA-65096 (usuário comum inválido no CDB$ROOT).',
        deepDive: {
          purpose:
            'Entender a arquitetura Multitenant (CDB x PDB) do Oracle 18c XE. O banco vem com uma instância raiz (CDB$ROOT) que gerencia o motor e um Pluggable Database plugável (XEPDB1) onde residem as tabelas e schemas da empresa.',
          breakdownTitle: 'Conceitos Essenciais da Conexão',
          breakdownItems: [
            {
              label: 'Container Raiz (CDB$ROOT / SID: XE)',
              description:
                'Destinado à administração do banco e da Oracle. Se tentar criar um usuário aqui com CREATE USER usr_treinamento, o Oracle rejeita com ORA-65096 porque exige o prefixo global C##.',
              code: 'ORA-65096: invalid common user or role name',
            },
            {
              label: 'Pluggable Database (PDB / Serviço: XEPDB1)',
              description:
                'É o banco de dados da aplicação! Aqui você pode criar usuários com nomes normais (ex: usr_treinamento) e suas tabelas de negócio.',
              code: 'ALTER SESSION SET CONTAINER = XEPDB1;',
            },
            {
              label: 'Parâmetro de Conexão no PL/SQL Developer',
              description:
                'No campo Database da tela de login, informe localhost:1521/XEPDB1 ou configure o alias XEPDB1 no tnsnames.ora.',
              code: 'localhost:1521/XEPDB1',
            },
          ],
          codeExample: `-- Conectar como SYSDBA ou SYSTEM apontando para o PDB:
sqlplus system/SuaSenha@localhost:1521/XEPDB1

-- Ou alternar a sessão atual para o PDB dentro do SQL*Plus:
ALTER SESSION SET CONTAINER = XEPDB1;
SHOW CON_NAME; -- Retorna: XEPDB1`,
          productionGotchas: [
            'Nunca crie tabelas da sua aplicação dentro do CDB$ROOT.',
            'Se reiniciar a máquina e o XEPDB1 estiver fechado (MOUNTED), execute como SYSDBA: ALTER PLUGGABLE DATABASE XEPDB1 OPEN;',
          ],
        },
      },
      {
        title: 'Cota de Armazenamento (QUOTA)',
        pathOrSyntax: 'QUOTA UNLIMITED ON users (ou QUOTA 500M ON users)',
        detail:
          'Mesmo com CREATE TABLE concedido, sem cota na tablespace o usuário recebe erro ORA-01950 ao tentar inserir a primeira linha de dados.',
        deepDive: {
          purpose:
            'A Cota de Armazenamento (QUOTA) define o limite físico de espaço que os dados de um usuário podem ocupar dentro de uma Tablespace. Criar uma tabela (DDL) apenas grava a definição no dicionário; quando a primeira linha é inserida (INSERT), o Oracle tenta alocar blocos de dados físicos na tablespace USERS. Sem cota, a inserção é bloqueada imediatamente.',
          breakdownTitle: 'Tipos de Cota e Como Funcionam',
          breakdownItems: [
            {
              label: 'QUOTA UNLIMITED ON <tablespace>',
              description:
                'O schema pode crescer livremente até o limite físico do arquivo (.dbf) da tablespace. Padrão para donos de aplicações em desenvolvimento.',
              code: 'QUOTA UNLIMITED ON users',
            },
            {
              label: 'QUOTA <Tamanho> ON <tablespace>',
              description:
                'Limita o schema a uma quantidade fixa em Megabytes ou Gigabytes. Prática essencial em bancos multi-cliente ou provedores para impedir que um usuário esgote o disco.',
              code: 'QUOTA 200M ON users',
            },
            {
              label: 'QUOTA 0 ON <tablespace>',
              description:
                'Revoga a cota para novos registros. Tabelas existentes continuam legíveis, mas qualquer novo INSERT ou expansão de tabela falhará com ORA-01950.',
              code: 'QUOTA 0 ON users',
            },
            {
              label: 'O Fim do UNLIMITED TABLESPACE na Role RESOURCE',
              description:
                'No Oracle 11g e anteriores, conceder RESOURCE atribuía automaticamente o privilégio de sistema perigoso UNLIMITED TABLESPACE (que dava acesso a tablespaces de sistema como SYSTEM e SYSAUX). Desde o Oracle 12c, a Oracle removeu isso! Por isso hoje é OBRIGATÓRIO rodar o comando explícito de QUOTA.',
            },
          ],
          codeExample: `-- Conceder cota no momento da criação do usuário:
CREATE USER usr_treinamento IDENTIFIED BY Treina123#
  DEFAULT TABLESPACE users
  QUOTA UNLIMITED ON users;

-- Ou atribuir cota posteriormente se o usuário já existir:
ALTER USER usr_treinamento QUOTA UNLIMITED ON users;
-- Ou cota limitada:
ALTER USER usr_treinamento QUOTA 250M ON users;

-- Consultar cotas concedidas atualmente no banco:
SELECT tablespace_name, bytes / (1024*1024) AS mb_utilizados,
       max_bytes / (1024*1024) AS mb_limite_maximo
  FROM user_ts_quotas;`,
          productionGotchas: [
            'Erro ORA-01950: no privileges on tablespace \'USERS\' acontece no primeiro INSERT, nunca no CREATE TABLE.',
            'Nunca conceda cota na tablespace SYSTEM nem SYSAUX para usuários comuns de aplicação.',
          ],
        },
      },
      {
        title: 'Privilégios de Sistema vs Objeto (GRANT CONNECT, RESOURCE, CREATE...)',
        pathOrSyntax: 'GRANT CONNECT, RESOURCE, CREATE VIEW TO ... | CREATE ANY ... (Perigo!)',
        detail:
          'Roles como CONNECT e RESOURCE agilizam o laboratório, mas CREATE VIEW é concedido explicitamente. Privilégios com "ANY" afetam schemas alheios e são proibidos em produção.',
        deepDive: {
          purpose:
            'Compreender o modelo de segurança do Oracle. Existem Privilégios de Sistema (ações genéricas como logar ou criar tabelas) e Privilégios de Objeto (ações em dados específicos de alguém, como dar SELECT na tabela de outro usuário).',
          breakdownTitle: 'O que Faz Cada GRANT e os Riscos do ANY',
          breakdownItems: [
            {
              label: 'Role CONNECT',
              description:
                'No Oracle moderno, contém apenas o privilégio básico CREATE SESSION. Sem ele, o usuário não consegue sequer autenticar no banco.',
              code: 'GRANT CONNECT TO usr_app;',
            },
            {
              label: 'Role RESOURCE',
              description:
                'Role padrão para desenvolvedores criarem objetos no PRÓPRIO schema: CREATE TABLE, CREATE SEQUENCE, CREATE PROCEDURE, CREATE TRIGGER, CREATE TYPE, CREATE CLUSTER. (Atenção: NÃO inclui CREATE VIEW nem QUOTA).',
              code: 'GRANT RESOURCE TO usr_app;',
            },
            {
              label: 'CREATE VIEW',
              description:
                'Permite criar visões virtuais dentro do próprio schema. Deve ser concedido explicitamente, pois não faz parte da role RESOURCE.',
              code: 'GRANT CREATE VIEW TO usr_app;',
            },
            {
              label: 'CREATE PROCEDURE / CREATE TRIGGER',
              description:
                'Permite compilar rotinas PL/SQL (Procedures, Functions, Packages) e gatilhos dentro do próprio schema.',
              code: 'GRANT CREATE PROCEDURE, CREATE TRIGGER TO usr_app;',
            },
            {
              label: 'PERIGO EXTREMO: Privilégios com o prefixo ANY (CREATE ANY TABLE, DROP ANY TABLE...)',
              description:
                'Privilégios comuns afetam apenas o PRÓPRIO schema. Privilégios com ANY quebram todo o isolamento: permitem ao usuário criar, alterar ou DELETAR objetos no schema de QUALQUER OUTRO USUÁRIO (inclusive SYSTEM e SYS!). Nunca conceda privilégios ANY a desenvolvedores ou usuários de aplicação em produção.',
              code: 'GRANT DROP ANY TABLE -- PROIBIDO EM PRODUÇÃO!',
            },
            {
              label: 'Privilégio de Objeto (GRANT SELECT, INSERT ON ...)',
              description:
                'Concedido pelo dono da tabela para outro usuário consultar ou alterar suas linhas sem dar permissão administrativa.',
              code: 'GRANT SELECT ON clientes TO usr_consulta;',
            },
          ],
          codeExample: `-- Concessão correta e segura para usuário de desenvolvimento (como SYSTEM em XEPDB1):
GRANT CONNECT, RESOURCE, CREATE VIEW TO usr_treinamento;

-- Concessão de Privilégio de Objeto (como USR_TREINAMENTO):
GRANT SELECT ON pedidos TO usr_auditor;
-- Conceder apenas SELECT e UPDATE em colunas específicas:
GRANT SELECT, UPDATE (status_pedido) ON pedidos TO usr_operador;

-- Consultar privilégios do usuário atual:
SELECT * FROM session_privs;`,
          productionGotchas: [
            'CREATE ANY TABLE permite que um usuário mal-intencionado injete código ou crie tabelas dentro do schema SYS.',
            'Se criar uma View baseada em tabelas de outro usuário, as permissões nas tabelas base precisam ter sido concedidas diretamente, não através de ROLES.',
          ],
        },
      },
      {
        title: 'Configuração e Para Que Serve o TNSNAMES.ORA',
        pathOrSyntax: '%ORACLE_HOME%\\network\\admin\\tnsnames.ora (ou via TNS_ADMIN)',
        detail:
          'Arquivo de resolução de nomes que mapeia o alias amigável (ex: XEPDB1) para Host, porta 1521 e SERVICE_NAME. Essencial para conectar o PL/SQL Developer e validado com tnsping.',
        deepDive: {
          purpose:
            'O TNSNAMES.ORA é o arquivo de configuração de rede do Oracle Net Services. Ele funciona exatamente como um "DNS local de bancos de dados": mapeia um apelido curto e amigável (ex: XEPDB1 ou BANCO_HOMOLOG) para a localização física real (IP do servidor, porta TCP 1521 e o nome do serviço registrado no Listener).',
          breakdownTitle: 'Estrutura do Arquivo e Como Configurar',
          breakdownItems: [
            {
              label: 'Alias de Rede (Nome do Bloco)',
              description:
                'O texto no início da entrada (ex: XEPDB1). É o que você digita no campo "Database" do PL/SQL Developer ou após o @ no SQL*Plus.',
              code: 'XEPDB1 = (...)',
            },
            {
              label: 'HOST e PORT',
              description:
                'HOST indica o IP ou nome da máquina onde o Oracle está rodando (localhost ou 192.168.x.x). PORT é a porta TCP do Listener (padrão 1521).',
              code: '(ADDRESS = (PROTOCOL = TCP)(HOST = localhost)(PORT = 1521))',
            },
            {
              label: 'SERVICE_NAME vs SID',
              description:
                'No Oracle 18c XE multitenant, use sempre SERVICE_NAME = XEPDB1. Bancos legados (Oracle 11g e anteriores) usavam a chave (SID = XE). Conectar em SID=XE no 18c te jogará no CDB$ROOT!',
              code: '(CONNECT_DATA = (SERVICE_NAME = XEPDB1))',
            },
            {
              label: 'Onde Encontrar o Arquivo no Sistema Operacional',
              description:
                'Localização padrão no Windows: C:\\app\\client\\...\\network\\admin\\tnsnames.ora ou na pasta do Oracle XE (C:\\app\\oracle\\product\\18.0.0\\dbhomeXE\\network\\admin\\tnsnames.ora).',
            },
            {
              label: 'Variável de Ambiente TNS_ADMIN',
              description:
                'Se você usa o PL/SQL Developer com Instant Client (sem instalador completo), crie uma variável de ambiente do Windows chamada TNS_ADMIN apontando para a pasta onde você salvou o tnsnames.ora.',
              code: 'TNS_ADMIN = C:\\Oracle\\InstantClient\\network\\admin',
            },
            {
              label: 'Utilitário de Teste: TNSPING',
              description:
                'Permite testar se o Oracle Listener está ativo e alcançável na rede antes mesmo de abrir qualquer software.',
              code: 'tnsping XEPDB1',
            },
          ],
          codeExample: `# Conteúdo modelo para colar dentro do arquivo tnsnames.ora:
XEPDB1 =
  (DESCRIPTION =
    (ADDRESS = (PROTOCOL = TCP)(HOST = localhost)(PORT = 1521))
    (CONNECT_DATA =
      (SERVER = DEDICATED)
      (SERVICE_NAME = XEPDB1)
    )
  )

# Teste de conectividade no CMD (Prompt de Comando):
tnsping XEPDB1
# Retorno de sucesso esperado:
# Attempting to contact (DESCRIPTION = (ADDRESS = (PROTOCOL = TCP)(HOST = localhost)(PORT = 1521)) (CONNECT_DATA = (SERVICE_NAME = XEPDB1)))
# OK (10 msec)`,
          productionGotchas: [
            'Erro TNS-12541: TNS:no listener significa que o serviço do Listener está parado no servidor ou bloqueado pelo Firewall do Windows na porta 1521.',
            'Erro TNS-03505: Failed to resolve name significa que o alias digitado não existe no tnsnames.ora ou o arquivo não está no caminho do TNS_ADMIN.',
            'No PL/SQL Developer, vá em Configure > Preferences > Oracle > Connection e verifique se os campos "Oracle Home" e "OCI Library" estão preenchidos.',
          ],
        },
      },
    ],
    usageExample: {
      title: 'Criação de Usuário de Leitura, Concessão Granular e Validação de TNS',
      explanation:
        'Demonstra como criar um segundo usuário de consulta (ex: analista de BI) com cota e privilégios mínimos no XEPDB1.',
      sql: `-- Executado como SYSTEM conectado em XEPDB1:
CREATE USER usr_consulta IDENTIFIED BY Consulta123#
  DEFAULT TABLESPACE users
  TEMPORARY TABLESPACE temp
  QUOTA 50M ON users;

GRANT CREATE SESSION TO usr_consulta;

-- Executado como USR_TREINAMENTO (dono da tabela):
GRANT SELECT ON usr_treinamento.clientes TO usr_consulta;

-- Teste de login com o alias configurado no tnsnames.ora:
-- sqlplus usr_consulta/Consulta123#@XEPDB1
SELECT * FROM usr_treinamento.clientes;`,
    },
    ddlScript: `-- ==========================================================
-- SCRIPT DDL INICIAL (Executar como SYSTEM em XEPDB1)
-- ==========================================================
CREATE USER usr_treinamento IDENTIFIED BY Treina123#
  DEFAULT TABLESPACE users
  TEMPORARY TABLESPACE temp
  QUOTA UNLIMITED ON users;

GRANT CONNECT, RESOURCE, CREATE VIEW, CREATE TRIGGER, CREATE PROCEDURE TO usr_treinamento;

-- ==========================================================
-- CONECTE-SE AGORA COMO USR_TREINAMENTO PARA CRIAR AS TABELAS
-- ==========================================================
CREATE TABLE clientes (
    id_cliente    NUMBER        CONSTRAINT pk_clientes PRIMARY KEY,
    nome          VARCHAR2(100) NOT NULL,
    email         VARCHAR2(120),
    limite_cred   NUMBER(10,2)  DEFAULT 1000.00,
    status        VARCHAR2(20)  DEFAULT 'ATIVO'
);

CREATE TABLE produtos (
    id_produto    NUMBER        CONSTRAINT pk_produtos PRIMARY KEY,
    descricao     VARCHAR2(100) NOT NULL,
    preco_unit    NUMBER(10,2)  NOT NULL,
    ativo         CHAR(1)       DEFAULT 'S'
);

CREATE TABLE pedidos (
    id_pedido     NUMBER        CONSTRAINT pk_pedidos PRIMARY KEY,
    id_cliente    NUMBER        NOT NULL,
    valor         NUMBER(10,2)  NOT NULL,
    status_pedido VARCHAR2(20)  DEFAULT 'ABERTO',
    data_pedido   DATE          DEFAULT SYSDATE,
    CONSTRAINT fk_pedidos_cliente FOREIGN KEY (id_cliente)
        REFERENCES clientes (id_cliente)
);`,
    dmlScript: `-- ==========================================================
-- SCRIPT DML INICIAL - POPULAÇÃO DE DADOS (USR_TREINAMENTO)
-- ==========================================================
INSERT INTO clientes (id_cliente, nome, email, limite_cred, status)
VALUES (1, 'Empresa Alfa Tecnologia', 'contato@alfa.com.br', 8500.00, 'ATIVO');

INSERT INTO clientes (id_cliente, nome, email, limite_cred, status)
VALUES (2, 'Comercio Beta Suprimentos', 'financeiro@beta.com.br', 2000.00, 'INATIVO');

INSERT INTO clientes (id_cliente, nome, email, limite_cred, status)
VALUES (3, 'Industria Gama Metalurgica', 'compras@gama.ind.br', 15000.00, 'ATIVO');

INSERT INTO clientes (id_cliente, nome, email, limite_cred, status)
VALUES (4, 'Logistica Delta Express', 'operacao@delta.com.br', 5000.00, 'ATIVO');

INSERT INTO produtos (id_produto, descricao, preco_unit, ativo)
VALUES (10, 'Licenca Anual ERP Modulo Fiscal', 1200.00, 'S');

INSERT INTO produtos (id_produto, descricao, preco_unit, ativo)
VALUES (20, 'pacote consultoria implantacao', 850.00, 'S');

INSERT INTO produtos (id_produto, descricao, preco_unit, ativo)
VALUES (30, 'Modulo Legado Descontinuado', 300.00, 'N');

INSERT INTO pedidos (id_pedido, id_cliente, valor, status_pedido, data_pedido)
VALUES (101, 1, 1200.00, 'FATURADO', SYSDATE - 5);

INSERT INTO pedidos (id_pedido, id_cliente, valor, status_pedido, data_pedido)
VALUES (102, 3, 2550.00, 'ABERTO', SYSDATE - 2);

INSERT INTO pedidos (id_pedido, id_cliente, valor, status_pedido, data_pedido)
VALUES (103, 1, 850.00, 'ABERTO', SYSDATE);

COMMIT;`,
    exercise: {
      title: 'Inspeção de Privilégios, Cota e Validação de TNS',
      scenario:
        'A equipe de auditoria externa precisa consultar apenas a tabela PEDIDOS do usuário USR_TREINAMENTO, sem permissão para alterar registros nem ver dados de outras tabelas, e conectando pelo alias XEPDB1.',
      tasks: [
        'Conectado como SYSTEM (em XEPDB1), crie o usuário usr_auditor com senha Auditor123# e cota de 10M na tablespace USERS.',
        'Conceda apenas permissão de login (CREATE SESSION) ao usr_auditor.',
        'Conectado como usr_treinamento, conceda SELECT apenas na tabela pedidos para usr_auditor e valide a leitura.',
        'Teste no CMD da sua máquina o comando tnsping XEPDB1 e verifique se o Listener responde com OK.',
      ],
      solutionSql: `-- 1. Como SYSTEM (em XEPDB1):
CREATE USER usr_auditor IDENTIFIED BY Auditor123#
  DEFAULT TABLESPACE users
  QUOTA 10M ON users;

GRANT CREATE SESSION TO usr_auditor;

-- 2. Como USR_TREINAMENTO:
GRANT SELECT ON pedidos TO usr_auditor;

-- 3. Validando permissões concedidas no dicionário de dados:
SELECT grantee, table_name, privilege
  FROM user_tab_privs_made
 WHERE grantee = 'USR_AUDITOR';

-- 4. Teste de login como USR_AUDITOR:
SELECT * FROM usr_treinamento.pedidos;`,
      notes:
        'Reforce com a turma que no Oracle, ao consultar objetos de outro schema, é necessário informar o prefixo do dono: SELECT * FROM usr_treinamento.pedidos;',
    },
    instructorTips: [
      'Rode o Script DDL e DML de Setup antes de começar o treinamento para já ter a base pronta na sua máquina.',
      'Mostre aos alunos a pasta onde o tnsnames.ora reside e rode o comando tnsping XEPDB1 no terminal para todos verem.',
    ],
  },
  {
    id: 'mod-plsqldev',
    title: 'Produtividade e Segurança no PL/SQL Developer',
    shortTitle: 'PL/SQL Developer',
    durationMinutes: 15,
    category: 'Ferramenta IDE',
    completed: false,
    conceptSummary:
      'O PL/SQL Developer (Allround Automations) possui ajustes nativos essenciais que evitam commits acidentais ao fechar a ferramenta, eliminam digitação repetitiva com substituição automática de siglas e agilizam a montagem de filtros IN a partir de grades de resultados ou planilhas.',
    keyPoints: [
      {
        title: '1. Rollback no Logoff / Disconnect',
        pathOrSyntax: 'Configure > Preferences > Oracle > Connection > Logoff with open transaction > Rollback',
        detail:
          'Garante que, se o desenvolvedor esquecer um UPDATE/DELETE sem commit e fechar o aplicativo, a transação seja desfeita em vez de gravada silenciosamente.',
        deepDive: {
          purpose:
            'Prevenir corrupção silenciosa de dados em produção. Por padrão em alguns clientes SQL, ao fechar a sessão ou desconectar, o driver pode executar um COMMIT implícito. Com esta opção ativada, qualquer transação esquecida aberta é abortada com segurança.',
          breakdownTitle: 'Comportamento da Preferência',
          breakdownItems: [
            {
              label: 'Opção ROLLBACK (Recomendada)',
              description:
                'Ao fechar a janela ou desconectar, o PL/SQL Developer emite um comando ROLLBACK no banco, cancelando qualquer DML incompleto.',
              code: 'Preferences > Connection > Logoff: Rollback',
            },
            {
              label: 'Opção COMMIT (Extremamente Perigosa)',
              description:
                'Grava no banco tudo o que estiver aberto na tela sem pedir confirmação!',
            },
            {
              label: 'Opção PROMPT',
              description:
                'Exibe uma caixa de diálogo perguntando se deseja salvar ou descartar.',
            },
          ],
          productionGotchas: [
            'Sempre configure Rollback em todas as instalações do PL/SQL Developer da sua equipe de suporte e sustentação.',
          ],
        },
      },
      {
        title: '2. AutoReplace (Expansão de Abreviações)',
        pathOrSyntax: 'Configure > Preferences > User Interface > Editor > AutoReplace',
        detail:
          'Permite cadastrar gatilhos de texto: ao digitar "sft" + Espaço, o editor expande automaticamente para "SELECT * FROM ".',
        deepDive: {
          purpose:
            'Aumentar drasticamente a velocidade de codificação e reduzir erros de digitação de comandos repetitivos do dia a dia.',
          breakdownTitle: 'Como Configurar o Arquivo autoreplace.txt',
          breakdownItems: [
            {
              label: 'Sintaxe básica',
              description: 'sigla=texto completo a ser expandido após pressionar espaço ou enter.',
              code: 'sft=SELECT * FROM \nsc=SELECT COUNT(1) FROM ',
            },
            {
              label: 'Compatibilidade com múltiplos desenvolvedores',
              description:
                'O arquivo de atalhos pode ser compartilhado em rede para toda a equipe de banco de dados.',
            },
          ],
          codeExample: `# Atalhos mais populares para o dia a dia:
sft=SELECT * FROM 
sc=SELECT COUNT(1) FROM 
sfw=SELECT * FROM  WHERE 1=1
upw=UPDATE  SET  WHERE 
dfw=DELETE FROM  WHERE 
co=CREATE OR REPLACE 
dbms=DBMS_OUTPUT.PUT_LINE('');`,
        },
      },
      {
        title: '3. Copy as Expression List',
        pathOrSyntax: 'Grid de Resultados > Selecionar Células > Botão Direito > Copy as expression list',
        detail:
          'Transforma instantaneamente uma coluna selecionada em uma lista formatada como (101, 102, 103) ou (\'ATIVO\', \'INATIVO\') pronta para colar dentro de um WHERE ... IN (...).',
        deepDive: {
          purpose:
            'Eliminar o trabalho manual de colocar aspas, vírgulas e parênteses em centenas de IDs ao transferir dados do resultado de uma query para outra.',
          breakdownTitle: 'Casos de Uso e Limites do Oracle',
          breakdownItems: [
            {
              label: 'Formatador Inteligente',
              description:
                'Se a coluna for VARCHAR2, ele adiciona aspas simples automaticamente. Se for NUMBER, copia apenas os números separados por vírgula.',
            },
            {
              label: 'Limite de 1000 Itens da Cláusula IN no Oracle',
              description:
                'Lembre à turma que o comando WHERE campo IN (...) tem um limite estrito de 1.000 expressões no Oracle (erro ORA-01795). Para mais de 1000 itens, deve-se usar tabela temporária ou subquery.',
              code: 'ORA-01795: maximum number of expressions in a list is 1000',
            },
          ],
        },
      },
      {
        title: '4. Restaurar Alertas "Don\'t show again"',
        pathOrSyntax: 'Configure > Preferences > User Interface > Options > Reset "Don\'t show again" flags',
        detail:
          'Recupera caixas de diálogo de confirmação (ex: aviso de compilação em outro schema ou commit pendente) marcadas acidentalmente com "Don\'t show this message again".',
        deepDive: {
          purpose:
            'Recuperar proteções e avisos importantes que foram ocultados por pressa ou engano pelo desenvolvedor.',
          breakdownItems: [
            {
              label: 'Onde fica',
              description: 'Preferences > User Interface > Options > Botão Reset "Don\'t show again" flags.',
            },
            {
              label: 'Avisos críticos protegidos',
              description:
                'Confirmação antes de compilar objetos em schemas de homologação/produção e avisos de perda de conexão.',
            },
          ],
        },
      },
    ],
    usageExample: {
      title: 'Arquivo Padrão de AutoReplace para Distribuir à Turma',
      explanation:
        'Os alunos podem colar estas definições diretamente na janela Edit do AutoReplace para padronizar os atalhos de produtividade da equipe.',
      sql: `-- Cole no menu: Preferences > User Interface > Editor > AutoReplace > Edit
sft=SELECT * FROM 
sc=SELECT COUNT(1) FROM 
sfw=SELECT * FROM  WHERE 1=1
upw=UPDATE  SET  WHERE 
dfw=DELETE FROM  WHERE 
co=CREATE OR REPLACE 
dbms=DBMS_OUTPUT.PUT_LINE('');`,
    },
    exercise: {
      title: 'Configuração Guiada + Uso Real do Copy as Expression List',
      scenario:
        'Você recebeu um chamado pedindo para inspecionar os pedidos apenas dos clientes ATIVOS retornados em uma primeira triagem na tela.',
      tasks: [
        'Ative a opção Rollback em Logoff with open transaction nas preferências da sua IDE.',
        'Cadastre o atalho "sft" no AutoReplace e use-o para listar a tabela CLIENTES.',
        'Filtre visualmente os ID_CLIENTE ativos no Grid, selecione os códigos, clique com o botão direito em "Copy as expression list" e monte um SELECT na tabela PEDIDOS colando a lista no IN (...).',
      ],
      solutionSql: `-- Passo 1: Consulta inicial digitando "sft" + espaço:
SELECT * FROM clientes WHERE status = 'ATIVO';

-- Passo 2: Após selecionar a coluna ID_CLIENTE no grid (1, 3, 4)
-- e usar botão direito > "Copy as expression list":
SELECT *
  FROM pedidos
 WHERE id_cliente IN (1, 3, 4);`,
      notes:
        'Mostre ao vivo também o atalho F8 para executar apenas a query sob o cursor ("AutoSelect statement" em Preferences > Window Types > SQL Window).',
    },
    instructorTips: [
      'Mostre onde fica o cadeado do Grid ("Edit data") e por que preferimos scripts UPDATE explícitos em vez de editar células manualmente.',
      'Demonstre marcar um alerta com "Don\'t show again" de propósito e restaurá-lo logo em seguida no painel Options.',
    ],
  },
  {
    id: 'mod-ddl-dml',
    title: 'DDL vs DML, Commit Automático, Backup CTAS e Subquery IN',
    shortTitle: 'DDL vs DML, CTAS & IN',
    durationMinutes: 20,
    category: 'Fundamentos SQL & Transações',
    completed: false,
    conceptSummary:
      'No Oracle, comandos DML (INSERT, UPDATE, DELETE, MERGE) iniciam transações isoladas que só se tornam permanentes após COMMIT e podem ser revertidas com ROLLBACK. Já comandos DDL (CREATE, ALTER, DROP, TRUNCATE) executam um COMMIT implícito imediatamente ANTES e DEPOIS de rodar — confirmando qualquer DML pendente na mesma sessão.',
    keyPoints: [
      {
        title: 'DML vs DDL e Armadilha do Commit Implícito',
        pathOrSyntax: 'UPDATE ... -> CREATE TABLE ... -> ROLLBACK (Não desfaz o UPDATE!)',
        detail:
          'Se você alterar uma tabela por engano e, na mesma janela/sessão, rodar qualquer CREATE ou TRUNCATE, o Oracle commita sua alteração pendente automaticamente.',
        deepDive: {
          purpose:
            'Entender a mecânica do motor de transações do Oracle. O DDL precisa alterar o catálogo de dados do SYS e, para garantir a consistência das tabelas do dicionário, o Oracle força um COMMIT antes e outro depois do comando DDL.',
          breakdownTitle: 'Comparativo Transacional',
          breakdownItems: [
            {
              label: 'DML (Data Manipulation Language)',
              description: 'INSERT, UPDATE, DELETE, MERGE. Ficam em buffer (Undo) até o COMMIT. Aceitam ROLLBACK total.',
            },
            {
              label: 'DDL (Data Definition Language)',
              description: 'CREATE, ALTER, DROP, TRUNCATE, RENAME. Fazem COMMIT implícito instantâneo e não aceitam ROLLBACK.',
            },
            {
              label: 'A Armadilha do Cenário Real',
              description:
                'O programador roda um UPDATE errado sem WHERE. Em pânico, cria uma tabela de backup (CREATE TABLE bkp AS...). O CREATE TABLE dispara o commit do UPDATE errado imediatamente!',
            },
          ],
          codeExample: `-- Exemplo do erro comum em sala:
UPDATE clientes SET status = 'INATIVO'; -- Sem WHERE por engano!
CREATE TABLE bkp_temp AS SELECT * FROM pedidos; -- DDL DISPARA COMMIT!
ROLLBACK; -- NÃO TEM MAIS EFEITO! Os clientes foram inativados no banco.`,
        },
      },
      {
        title: 'Backup Rápido via CTAS (Create Table As Select)',
        pathOrSyntax: 'CREATE TABLE bkp_tabela AS SELECT * FROM tabela_origem;',
        detail:
          'Cria uma fotografia imediata dos dados antes de manutenções críticas. Copia tipos de colunas e constraints NOT NULL, mas NÃO copia PK, FK, índices, defaults nem triggers.',
        deepDive: {
          purpose:
            'Criar cópias de segurança pontuais antes de rodar correções manuais de dados.',
          breakdownTitle: 'O que o CTAS Herda e o que ele Perde',
          breakdownItems: [
            {
              label: 'O que é COPIADO com sucesso',
              description: 'Nomes de colunas, tipos de dados (VARCHAR2, NUMBER, DATE) e constraints NOT NULL.',
            },
            {
              label: 'O que se PERDE e não é copiado',
              description:
                'Chaves Primárias (PK), Chaves Estrangeiras (FK), Índices, Triggers e valores DEFAULT. Devem ser recriados se a tabela for promovida a definitiva.',
            },
            {
              label: 'CTAS de Estrutura Vazia (WHERE 1 = 0)',
              description: 'Duplica apenas a estrutura da tabela sem copiar nenhuma linha de dados.',
              code: 'CREATE TABLE tab_modelo AS SELECT * FROM tab_origem WHERE 1 = 0;',
            },
          ],
        },
      },
      {
        title: 'Comparativo com Subconsulta IN',
        pathOrSyntax: 'SELECT * FROM tab_a WHERE id IN (SELECT id FROM tab_b WHERE ...)',
        detail:
          'Permite filtrar registros baseados no conjunto de chaves retornado dinamicamente por outra tabela, sem duplicar linhas caso haja relacionamento 1:N.',
        deepDive: {
          purpose:
            'Filtrar uma entidade pai baseado nas características dos filhos sem duplicar linhas na saída.',
          breakdownTitle: 'IN vs JOIN vs EXISTS',
          breakdownItems: [
            {
              label: 'Vantagem do IN sobre o INNER JOIN',
              description:
                'Se um cliente tiver 10 pedidos abertos, o INNER JOIN retorna o cliente repetido 10 vezes (exigindo DISTINCT). O WHERE id IN (...) retorna o cliente apenas UMA vez.',
            },
            {
              label: 'A Armadilha do NULL com NOT IN',
              description:
                'Se houver um único NULL no resultado retornado pela subquery do NOT IN, a consulta inteira retornará ZERO linhas! Prefira sempre NOT EXISTS ou filtre IS NOT NULL.',
            },
          ],
        },
      },
    ],
    usageExample: {
      title: 'Rotina Segura de Manutenção com CTAS + Subquery IN',
      explanation:
        'Antes de aplicar um ajuste nos pedidos de clientes ativos, salvamos o backup via CTAS e validamos o público-alvo com Subquery IN.',
      sql: `-- 1. Criando backup pontual da tabela antes da manutenção (DDL -> faz commit!)
CREATE TABLE bkp_pedidos_aula AS
SELECT * FROM pedidos;

-- 2. Consultando clientes que possuem pedidos acima de R$ 1.000 usando Subquery IN
SELECT c.id_cliente, c.nome, c.status
  FROM clientes c
 WHERE c.id_cliente IN (
       SELECT p.id_cliente
         FROM pedidos p
        WHERE p.valor >= 1000
 );

-- 3. Dica extra: criar apenas estrutura vazia (sem linhas) com CTAS
CREATE TABLE modelo_pedidos_vazio AS
SELECT * FROM pedidos WHERE 1 = 0;`,
    },
    ddlScript: `-- Caso precise recriar/limpar backups anteriores durante a demonstração:
DROP TABLE bkp_pedidos_aula PURGE;
DROP TABLE bkp_clientes_ativos PURGE;`,
    dmlScript: `-- Carga complementar de pedidos para enriquecer o comparativo IN:
INSERT INTO pedidos (id_pedido, id_cliente, valor, status_pedido, data_pedido)
VALUES (104, 4, 3400.00, 'FATURADO', SYSDATE - 1);

INSERT INTO pedidos (id_pedido, id_cliente, valor, status_pedido, data_pedido)
VALUES (105, 3, 420.00, 'CANCELADO', SYSDATE);

COMMIT;`,
    exercise: {
      title: 'Backup Preventivo CTAS e Triagem com Subquery IN',
      scenario:
        'O setor comercial pediu: (1) salvar uma tabela de backup contendo apenas os clientes ATIVOS antes de uma higienização cadastral e (2) listar todos os clientes que possuem pelo menos um pedido com status ABERTO.',
      tasks: [
        'Crie a tabela bkp_clientes_ativos via CTAS filtrando apenas clientes com status = \'ATIVO\'.',
        'Escreva um SELECT na tabela clientes usando WHERE id_cliente IN (...) para retornar somente quem tem pedido com status_pedido = \'ABERTO\'.',
        'Teste na prática: faça um UPDATE mudando o valor do pedido 101 para 1, execute ROLLBACK e confirme que voltou ao valor original.',
      ],
      solutionSql: `-- 1. Backup filtrado usando CTAS
CREATE TABLE bkp_clientes_ativos AS
SELECT *
  FROM clientes
 WHERE status = 'ATIVO';

-- Conferindo o backup gerado:
SELECT * FROM bkp_clientes_ativos;

-- 2. Clientes com pelo menos um pedido em ABERTO (sem duplicar o cliente!)
SELECT id_cliente, nome, limite_cred
  FROM clientes
 WHERE id_cliente IN (
       SELECT id_cliente
         FROM pedidos
        WHERE status_pedido = 'ABERTO'
 );

-- 3. Teste controlado de transação DML + ROLLBACK
UPDATE pedidos SET valor = 1 WHERE id_pedido = 101;
SELECT id_pedido, valor FROM pedidos WHERE id_pedido = 101; -- Mostra 1
ROLLBACK;
SELECT id_pedido, valor FROM pedidos WHERE id_pedido = 101; -- Volta para 1200`,
      notes:
        'Aproveite a aba "Simulador Transacional" deste aplicativo para mostrar visualmente na tela o que ocorreria se um CREATE TABLE fosse executado antes do ROLLBACK!',
    },
    instructorTips: [
      'Mostre a diferença entre DELETE FROM tabela (DML, aceita Rollback) e TRUNCATE TABLE tabela (DDL, imediato e irreversível via Rollback).',
      'Destaque por que usar IN na tabela CLIENTES retorna cada cliente apenas 1 vez, mesmo que ele tenha 10 pedidos abertos.',
    ],
  },
  {
    id: 'mod-views',
    title: 'Camada de Abstração, Segurança e Dicionário de Dados do Oracle',
    shortTitle: 'Views de Consulta & Dicionários',
    durationMinutes: 20,
    category: 'Objetos de Consulta & Metadados',
    completed: false,
    conceptSummary:
      'Uma View é uma instrução SELECT nomeada e armazenada no dicionário de dados que se comporta como uma tabela virtual sem duplicar espaço em disco. Além das views de negócio, o Oracle possui visões nativas de dicionário (ALL_TAB_COLS, ALL_VIEWS, USER_TABLES, USER_SOURCE, ALL_SOURCE) fundamentais para inspecionar estruturas e buscar referências em todo o código.',
    keyPoints: [
      {
        title: 'CREATE OR REPLACE VIEW & Segurança',
        pathOrSyntax: 'CREATE OR REPLACE VIEW vw_nome AS SELECT ...',
        detail:
          'Permite atualizar a definição das colunas e filtros da view preservando todos os GRANTs já concedidos aos usuários consumidores.',
        deepDive: {
          purpose:
            'Encapsular cálculos complexos e esconder colunas confidenciais. Uma View não armazena cópia física dos dados; na execução, o otimizador combina a query da View com a query do usuário.',
          breakdownTitle: 'Benefícios e Opções Avançadas',
          breakdownItems: [
            {
              label: 'WITH READ ONLY',
              description: 'Impede terminantemente que qualquer usuário tente executar INSERT, UPDATE ou DELETE através da View.',
              code: 'CREATE VIEW v_relatorio AS SELECT ... WITH READ ONLY;',
            },
            {
              label: 'Aliases Obrigatórios em Funções',
              description: 'Toda coluna calculada ou agrupada (COUNT, SUM, CASE) precisa de um alias explícito.',
            },
          ],
        },
      },
      {
        title: 'Dicionários de Metadados: USER_* vs ALL_* vs DBA_*',
        pathOrSyntax: 'USER_TABLES | ALL_TABLES | DBA_TABLES',
        detail:
          'USER_* lista objetos do schema atual; ALL_* lista objetos que o usuário tem permissão de ver; DBA_* lista todos os objetos do banco inteiro.',
        deepDive: {
          purpose:
            'Compreender como o Oracle organiza as visões do sistema. Todo objeto no banco gera registros automáticos nas tabelas base do SYS, expostas em 3 níveis de visibilidade.',
          breakdownItems: [
            {
              label: 'USER_*',
              description: 'Mostra apenas o que pertence ao usuário conectado. É o mais rápido e não exige permissões especiais.',
            },
            {
              label: 'ALL_*',
              description: 'Mostra objetos do seu schema mais os objetos de outros usuários aos quais você recebeu GRANT.',
            },
            {
              label: 'DBA_*',
              description: 'Visão de raio-X global do banco inteiro. Apenas DBAs e usuários com SELECT ANY DICTIONARY conseguem consultar.',
            },
          ],
        },
      },
      {
        title: 'Consultas no Dicionário: ALL_TAB_COLS, ALL_VIEWS, USER_TABLES, USER_SOURCE',
        pathOrSyntax: 'SELECT * FROM user_tab_cols / user_source / all_views;',
        detail:
          'Permite descobrir em quais tabelas uma coluna existe, inspecionar o SQL original de uma view e fazer um "Ctrl+F" em todo o código PL/SQL compilado.',
        deepDive: {
          purpose:
            'Resolver os problemas diários de sustentação: onde está a coluna X? Em quais procedures a tabela Y é alterada? Como a view Z foi escrita originalmente?',
          breakdownTitle: 'As 4 Visões Mais Importantes do Desenvolvedor',
          breakdownItems: [
            {
              label: 'USER_TAB_COLS / ALL_TAB_COLS',
              description:
                'Onde estão as colunas! Permite localizar qualquer campo no banco, tipo de dado (VARCHAR2, NUMBER), tamanho e se aceita nulo.',
              code: 'SELECT table_name, column_name FROM user_tab_cols WHERE column_name LIKE \'%CLIENTE%\';',
            },
            {
              label: 'USER_SOURCE / ALL_SOURCE (O "Ctrl+F" do Banco)',
              description:
                'Armazena o código-fonte linha a linha de Procedures, Functions, Packages e Triggers. Indispensável para saber onde uma tabela é alterada antes de fazer manutenção.',
              code: 'SELECT name, type, line, text FROM user_source WHERE UPPER(text) LIKE \'%PEDIDOS%\';',
            },
            {
              label: 'USER_VIEWS / ALL_VIEWS',
              description:
                'Permite ler a declaração SQL completa que gerou a view através da coluna TEXT.',
              code: 'SELECT view_name, text FROM user_views;',
            },
            {
              label: 'USER_TABLES',
              description:
                'Lista todas as tabelas do schema, em qual tablespace estão armazenadas e estimativa de linhas (NUM_ROWS).',
              code: 'SELECT table_name, tablespace_name, num_rows FROM user_tables;',
            },
          ],
          codeExample: `-- 1. Achar todas as tabelas com a coluna CLIENTE no nome:
SELECT table_name, column_name, data_type, data_length
  FROM user_tab_cols
 WHERE column_name LIKE '%CLIENTE%'
 ORDER BY table_name;

-- 2. Pesquisar onde a tabela PEDIDOS é utilizada em rotinas PL/SQL:
SELECT name, type, line, text
  FROM user_source
 WHERE UPPER(text) LIKE '%PEDIDOS%'
 ORDER BY name, line;`,
          productionGotchas: [
            'Nomes de tabelas e colunas são gravados em MAIÚSCULAS no dicionário do Oracle por padrão. Sempre use UPPER() ou nomes em caixa alta.',
          ],
        },
      },
    ],
    usageExample: {
      title: 'View Operacional Unindo Clientes e Pedidos + Investigação no Dicionário',
      explanation:
        'Encapsula múltiplos JOINs em uma View de negócio e em seguida investiga a estrutura criada consultando USER_VIEWS e USER_TAB_COLS.',
      sql: `-- 1. Criando a View Operacional
CREATE OR REPLACE VIEW vw_painel_pedidos AS
SELECT p.id_pedido,
       p.data_pedido,
       c.id_cliente,
       c.nome AS nome_cliente,
       c.status AS status_cliente,
       p.status_pedido,
       p.valor AS valor_bruto,
       COUNT(i.id_item) AS qtd_itens
  FROM pedidos p
  INNER JOIN clientes c ON c.id_cliente = p.id_cliente
  LEFT JOIN itens_pedido i ON i.id_pedido = p.id_pedido
 GROUP BY p.id_pedido, p.data_pedido, c.id_cliente, c.nome, c.status, p.status_pedido, p.valor;

-- 2. Consultando o Dicionário de Dados para ver as colunas da View:
SELECT column_name, data_type, data_length
  FROM user_tab_cols
 WHERE table_name = 'VW_PAINEL_PEDIDOS';

-- 3. Inspecionando o código SQL original armazenado no dicionário:
SELECT view_name, text
  FROM user_views
 WHERE view_name = 'VW_PAINEL_PEDIDOS';`,
    },
    ddlScript: `-- ==========================================================
-- DDL EXCLUSIVO DO MÓDULO 3 (VIEWS)
-- Cria tabela auxiliar de itens para enriquecer os JOINs da View
-- ==========================================================
CREATE TABLE itens_pedido (
    id_item       NUMBER        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_pedido     NUMBER        NOT NULL,
    id_produto    NUMBER        NOT NULL,
    quantidade    NUMBER(6)     NOT NULL,
    preco_pratic  NUMBER(10,2)  NOT NULL,
    CONSTRAINT fk_itens_pedido FOREIGN KEY (id_pedido)
        REFERENCES pedidos (id_pedido),
    CONSTRAINT fk_itens_produto FOREIGN KEY (id_produto)
        REFERENCES produtos (id_produto)
);`,
    dmlScript: `-- ==========================================================
-- DML EXCLUSIVO DO MÓDULO 3 - POPULAÇÃO DE ITENS DE PEDIDO
-- ==========================================================
INSERT INTO itens_pedido (id_pedido, id_produto, quantidade, preco_pratic)
VALUES (101, 10, 1, 1200.00);

INSERT INTO itens_pedido (id_pedido, id_produto, quantidade, preco_pratic)
VALUES (102, 20, 3, 850.00);

INSERT INTO itens_pedido (id_pedido, id_produto, quantidade, preco_pratic)
VALUES (103, 20, 1, 850.00);

INSERT INTO itens_pedido (id_pedido, id_produto, quantidade, preco_pratic)
VALUES (104, 10, 2, 1200.00);

INSERT INTO itens_pedido (id_pedido, id_produto, quantidade, preco_pratic)
VALUES (104, 20, 1, 1000.00);

COMMIT;`,
    exercise: {
      title: 'Criação de View Comercial + Exploração dos Dicionários de Dados',
      scenario:
        'A equipe precisa: (1) criar uma view segura de pedidos sem expor limite de crédito e (2) fazer uma busca no dicionário do Oracle para descobrir todas as tabelas que contêm colunas com o termo "CLIENTE" e consultar o código em USER_VIEWS.',
      tasks: [
        'Execute o DDL e o DML deste módulo caso ainda não tenha populado a tabela itens_pedido.',
        'Crie a view v_pedidos_detalhados trazendo: id_pedido, nome_cliente, email, status_cliente, status_pedido, valor e tipo_porte (\'ALTO VALOR\' se valor >= 2000, senão \'PADRAO\').',
        'Consulte a view USER_VIEWS para inspecionar o código SQL da view criada.',
        'Faça uma consulta em USER_TAB_COLS para listar todas as tabelas do seu usuário que possuem qualquer coluna com o termo "CLIENTE".',
      ],
      solutionSql: `-- 1. Criação da View
CREATE OR REPLACE VIEW v_pedidos_detalhados AS
SELECT p.id_pedido,
       c.nome          AS nome_cliente,
       c.email         AS email_cliente,
       c.status        AS status_cliente,
       p.status_pedido,
       p.valor,
       CASE
           WHEN p.valor >= 2000 THEN 'ALTO VALOR'
           ELSE 'PADRAO'
       END             AS tipo_porte
  FROM pedidos p
  INNER JOIN clientes c ON c.id_cliente = p.id_cliente;

-- 2. Consumo da View:
SELECT *
  FROM v_pedidos_detalhados
 WHERE status_cliente = 'ATIVO'
 ORDER BY valor DESC;

-- 3. Inspecionando o código SQL gravado no dicionário USER_VIEWS:
SELECT view_name, text
  FROM user_views
 WHERE view_name = 'V_PEDIDOS_DETALHADOS';

-- 4. Localizando no dicionário USER_TAB_COLS todas as tabelas com a coluna CLIENTE:
SELECT table_name, column_name, data_type, nullable
  FROM user_tab_cols
 WHERE column_name LIKE '%CLIENTE%'
 ORDER BY table_name;`,
      notes:
        'Mostre que no PL/SQL Developer, ao expandir a pasta "Views" no navegador à esquerda, ele roda exatamente uma consulta em ALL_VIEWS por debaixo dos panos!',
    },
    instructorTips: [
      'Evite usar SELECT * dentro de Views em produção, pois adicionar colunas futuras na tabela base pode invalidar ou expor dados indevidos.',
      'Destaque como a visão USER_SOURCE é a melhor amiga do desenvolvedor para localizar procedures legadas em grandes ERPs.',
    ],
  },
  {
    id: 'mod-plsql',
    title: 'PL/SQL: Laços para Múltiplos Inserts/Updates, Rotinas e Test Window',
    shortTitle: 'PL/SQL, Loops & Test Window',
    durationMinutes: 25,
    category: 'Programação PL/SQL',
    completed: false,
    conceptSummary:
      'O PL/SQL adiciona controle procedural (variáveis, condicionais IF/ELSIF, cursores, laços FOR LOOP e tratamento de exceções) diretamente dentro do motor do banco Oracle. Permite processar múltiplos INSERTs e UPDATEs em um único envio de rede, além de encapsular regras reutilizáveis em Procedures e Functions depuráveis via Test Window.',
    keyPoints: [
      {
        title: 'Laço FOR LOOP (Numérico e Cursor Implícito)',
        pathOrSyntax: 'FOR r IN (SELECT ...) LOOP ... END LOOP;',
        detail:
          'Abre, percorre linha a linha e fecha o cursor automaticamente — excelente para aplicar múltiplos UPDATEs com regras condicionais ou gerar múltiplos INSERTs de parcelas/logs.',
        deepDive: {
          purpose:
            'Executar processamento em lote linha por linha sem ter o trabalho de declarar, abrir (OPEN), fazer fetch e fechar (CLOSE) cursores manualmente.',
          breakdownItems: [
            {
              label: 'FOR i IN 1..N LOOP (Numérico)',
              description: 'Excelente para rotinas de geração sequencial de dados, simulação de parcelas e logs.',
            },
            {
              label: 'Cursor FOR LOOP',
              description: 'O Oracle gerencia a memória do cursor automaticamente e fecha ao atingir a última linha.',
            },
          ],
        },
      },
      {
        title: 'Procedure vs Function',
        pathOrSyntax: 'PROCEDURE executa ação | FUNCTION retorna valor (RETURN)',
        detail:
          'Procedures orquestram gravações e parâmetros OUT; Functions retornam obrigatoriamente um valor escalar/objeto e podem ser chamadas dentro de comandos SELECT.',
        deepDive: {
          purpose:
            'Encapsular lógica de negócio no banco. Functions calculam e devolvem um resultado (podem rodar dentro de SELECTs); Procedures executam fluxos completos de gravação e processamento.',
          breakdownItems: [
            {
              label: 'Regra de Pureza da Function para uso em SELECT',
              description:
                'Uma Function só pode ser chamada em um SELECT se NÃO executar comandos DML (INSERT/UPDATE/DELETE) em tabelas.',
            },
            {
              label: 'Parâmetros IN, OUT e IN OUT',
              description: 'Procedures podem devolver múltiplos valores através de parâmetros com o modificador OUT.',
            },
          ],
        },
      },
      {
        title: 'Ferramenta Test Window (PL/SQL Developer)',
        pathOrSyntax: 'Botão Direito na Procedure/Function > Test (F9 Debug / Ctrl+N Step Into)',
        detail:
          'Gera automaticamente o bloco PL/SQL de chamada com grade inferior para informar parâmetros de entrada, ler variáveis de saída, ver DBMS_OUTPUT e depurar linha a linha.',
        deepDive: {
          purpose:
            'Depurar Procedures e Functions sem precisar escrever blocos DECLARE anônimos na mão.',
          breakdownItems: [
            {
              label: 'Grade de Variáveis',
              description: 'Permite digitar valores para parâmetros IN e visualizar o retorno de parâmetros OUT.',
            },
            {
              label: 'Breakpoints e Debug (F9)',
              description:
                'Clique na barra lateral de uma linha da procedure para marcar uma bolinha vermelha (breakpoint) e acompanhar o valor das variáveis passo a passo.',
            },
          ],
        },
      },
    ],
    usageExample: {
      title: 'Laço de Repetição Executando Múltiplos INSERTs e Múltiplos UPDATEs',
      explanation:
        'Demonstra os dois formatos clássicos de loop em PL/SQL: (1) geração sequencial de registros (INSERT) e (2) varredura de registros para atualização condicional em lote (UPDATE).',
      sql: `DECLARE
    v_reajuste NUMBER(5,2);
BEGIN
    -- Caso A: Laço numérico gerando múltiplos INSERTs em lote
    FOR i IN 1..5 LOOP
        INSERT INTO log_processamento (origem, mensagem, data_log)
        VALUES ('LOTE_INICIAL', 'Etapa de verificacao numero ' || i, SYSDATE);
    END LOOP;

    -- Caso B: Cursor FOR LOOP realizando múltiplos UPDATEs condicionais
    FOR r_ped IN (
        SELECT id_pedido, valor, status_pedido
          FROM pedidos
         WHERE status_pedido = 'ABERTO'
    ) LOOP
        IF r_ped.valor >= 2000 THEN
            v_reajuste := 0.95; -- 5% de desconto promocional
        ELSE
            v_reajuste := 0.98; -- 2% de desconto padrão
        END IF;

        UPDATE pedidos
           SET valor = ROUND(r_ped.valor * v_reajuste, 2)
         WHERE id_pedido = r_ped.id_pedido;

        INSERT INTO log_processamento (origem, mensagem, data_log)
        VALUES ('AJUSTE_PEDIDO', 'Pedido ' || r_ped.id_pedido || ' atualizado.', SYSDATE);
    END LOOP;

    COMMIT;
END;
/`,
    },
    ddlScript: `-- ==========================================================
-- DDL DO MÓDULO 4 (TABELA DE LOG + PROCEDURE + FUNCTION)
-- ==========================================================
CREATE TABLE log_processamento (
    id_log    NUMBER        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    origem    VARCHAR2(40)  NOT NULL,
    mensagem  VARCHAR2(200) NOT NULL,
    data_log  DATE          DEFAULT SYSDATE
);

-- Function: Valida se um cliente está ativo ('S', 'N' ou 'INEXISTENTE')
CREATE OR REPLACE FUNCTION fn_valida_cliente_ativo (
    p_id_cliente IN clientes.id_cliente%TYPE
) RETURN VARCHAR2 IS
    v_status clientes.status%TYPE;
BEGIN
    SELECT status
      INTO v_status
      FROM clientes
     WHERE id_cliente = p_id_cliente;

    IF v_status = 'ATIVO' THEN
        RETURN 'S';
    ELSE
        RETURN 'N';
    END IF;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN 'INEXISTENTE';
END fn_valida_cliente_ativo;
/

-- Procedure: Reajusta limite de crédito em lote para clientes ativos
CREATE OR REPLACE PROCEDURE prc_reajusta_limite_ativos (
    p_percentual IN  NUMBER,
    p_qtd_afeta  OUT NUMBER
) IS
    v_cont NUMBER := 0;
BEGIN
    FOR r_cli IN (SELECT id_cliente, nome, limite_cred FROM clientes WHERE status = 'ATIVO') LOOP
        UPDATE clientes
           SET limite_cred = ROUND(r_cli.limite_cred * (1 + (p_percentual / 100)), 2)
         WHERE id_cliente = r_cli.id_cliente;

        v_cont := v_cont + 1;
        DBMS_OUTPUT.PUT_LINE('Cliente ' || r_cli.nome || ' ajustado.');
    END LOOP;

    p_qtd_afeta := v_cont;
    COMMIT;
END prc_reajusta_limite_ativos;
/`,
    dmlScript: `-- Carga opcional de cliente adicional sem pedidos para testar a Function:
INSERT INTO clientes (id_cliente, nome, email, limite_cred, status)
VALUES (5, ' varejo epsilon ltda ', 'contato@epsilon.com.br', 1500.00, 'INATIVO');
COMMIT;`,
    exercise: {
      title: 'Prática com Loop em Lote + Inspeção na Test Window',
      scenario:
        'Precisamos testar na Test Window a Function fn_valida_cliente_ativo e a Procedure prc_reajusta_limite_ativos, além de escrever um bloco PL/SQL que gere 4 parcelas simuladas para o pedido 102.',
      tasks: [
        'Compile a Function fn_valida_cliente_ativo e a Procedure prc_reajusta_limite_ativos (DDL acima).',
        'No navegador lateral Objects do PL/SQL Developer, clique com o botão direito em prc_reajusta_limite_ativos > Test, informe p_percentual = 10, aperte F8 e confira o retorno em p_qtd_afeta e na aba DBMS Output.',
        'Escreva um bloco anônimo com FOR i IN 1..4 LOOP inserindo 4 mensagens de parcelas na tabela log_processamento.',
      ],
      solutionSql: `-- 1. Uso direto da Function em um comando SELECT:
SELECT id_cliente,
       nome,
       status,
       fn_valida_cliente_ativo(id_cliente) AS cliente_habilitado
  FROM clientes;

-- 2. Bloco anônimo gerando 4 parcelas simuladas do pedido 102:
DECLARE
    v_valor_pedido pedidos.valor%TYPE;
    v_valor_parc   NUMBER(10,2);
BEGIN
    SELECT valor INTO v_valor_pedido FROM pedidos WHERE id_pedido = 102;
    v_valor_parc := ROUND(v_valor_pedido / 4, 2);

    FOR parcela IN 1..4 LOOP
        INSERT INTO log_processamento (origem, mensagem, data_log)
        VALUES (
            'PARCELAMENTO_102',
            'Parcela ' || parcela || '/4 no valor de R$ ' || v_valor_parc ||
            ' - Vencimento: ' || TO_CHAR(ADD_MONTHS(SYSDATE, parcela), 'DD/MM/YYYY'),
            SYSDATE
        );
    END LOOP;

    COMMIT;
END;
/

-- Conferindo os registros gerados pelo laço:
SELECT * FROM log_processamento ORDER BY id_log DESC;`,
      notes:
        'Na Test Window, mostre como colocar um Breakpoint clicando na margem esquerda da linha do UPDATE e pressionar F9 (Start Debugger) para inspecionar o valor de r_cli.limite_cred passando o mouse por cima.',
    },
    instructorTips: [
      'Explique o uso de %TYPE (ex: clientes.status%TYPE) para herdar automaticamente o tipo e tamanho da coluna da tabela.',
      'Lembre aos alunos que no SQLPlus/SQL Window um bloco PL/SQL ou CREATE TRIGGER/PROCEDURE termina com barra (/) em linha isolada.',
    ],
  },
  {
    id: 'mod-triggers',
    title: 'Triggers: Before vs After, Condicionais, Tabela Mutante e Disable',
    shortTitle: 'Triggers & Tabela Mutante',
    durationMinutes: 25,
    category: 'Triggers & Regras de Banco',
    completed: false,
    conceptSummary:
      'Triggers são gatilhos disparados automaticamente pelo Oracle quando um comando INSERT, UPDATE ou DELETE atinge uma tabela. Triggers BEFORE interceptam os dados antes da gravação (ideais para formatar :NEW ou barrar erros de regra), enquanto Triggers AFTER rodam após a validação das linhas (ideais para alimentar tabelas de auditoria).',
    keyPoints: [
      {
        title: 'Tipos BEFORE vs AFTER (:NEW e :OLD)',
        pathOrSyntax: 'BEFORE: altera :NEW e valida | AFTER: grava auditoria externa',
        detail:
          'No INSERT existe apenas :NEW; no DELETE existe apenas :OLD; no UPDATE existem ambos (:OLD valor anterior e :NEW valor novo). Em triggers AFTER não é permitido alterar :NEW.',
        deepDive: {
          purpose:
            'Entender em qual momento do ciclo de vida da transação o gatilho deve rodar.',
          breakdownTitle: 'Matriz de Uso Recomendado',
          breakdownItems: [
            {
              label: 'BEFORE INSERT / UPDATE',
              description:
                'Roda ANTES do bloco de dados ser gravado. É o ÚNICO momento onde você pode sobrescrever o valor de :NEW (ex: aplicar TRIM, UPPER ou calcular chaves) e lançar RAISE_APPLICATION_ERROR para abortar.',
            },
            {
              label: 'AFTER INSERT / UPDATE / DELETE',
              description:
                'Roda DEPOIS que a linha foi aceita pelas constraints. Ideal para alimentar tabelas de auditoria e emitir notificações.',
            },
          ],
        },
      },
      {
        title: 'Trigger Única com Predicados Condicionais',
        pathOrSyntax: 'IF INSERTING ... ELSIF UPDATING ... ELSIF DELETING',
        detail:
          'Evita espalhar 3 triggers separadas na mesma tabela, centralizando a lógica de auditoria ou validação por evento.',
        deepDive: {
          purpose:
            'Simplificar a arquitetura de banco consolidando regras correlatas em um único gatilho legível.',
          breakdownItems: [
            {
              label: 'Predicados nativos do Oracle',
              description: 'INSERTING, UPDATING, DELETING e UPDATING(\'nome_coluna\') para checar se uma coluna específica mudou.',
            },
          ],
        },
      },
      {
        title: 'Erro Clássico de Tabela Mutante (ORA-04091)',
        pathOrSyntax: 'ORA-04091: table USR_TREINAMENTO.PEDIDOS is mutating',
        detail:
          'Acontece quando uma trigger de linha (FOR EACH ROW) tenta executar um SELECT ou DML na PRÓPRIA tabela que a disparou no meio da alteração. O Oracle bloqueia para impedir leitura inconsistente.',
        deepDive: {
          purpose:
            'Entender a regra de leitura consistente (Read Consistency) do Oracle. Enquanto um UPDATE multi-linha está rodando em PEDIDOS, a tabela está em estado instável ("mutante"). Se a trigger tentar fazer SELECT em PEDIDOS, ela não saberia se lê as linhas antes ou depois da modificação.',
          breakdownTitle: 'Como Solucionar a Tabela Mutante',
          breakdownItems: [
            {
              label: 'Solução 1: Trigger em Nível de Instrução',
              description: 'Remover o FOR EACH ROW se o cálculo puder ser feito após a instrução inteira terminar.',
            },
            {
              label: 'Solução 2: Compound Trigger (Oracle 11g+)',
              description: 'Gatilho composto que divide a execução em 4 seções (BEFORE STATEMENT, BEFORE EACH ROW, AFTER EACH ROW, AFTER STATEMENT), acumulando IDs em memória.',
            },
          ],
        },
      },
      {
        title: 'Habilitar e Desabilitar Triggers',
        pathOrSyntax: 'ALTER TRIGGER nome DISABLE; | ALTER TRIGGER nome ENABLE;',
        detail:
          'Indispensável para cargas históricas legadas ou para desativar imediatamente um gatilho problemático sem apagar seu código-fonte.',
        deepDive: {
          purpose:
            'Interromper temporariamente o disparo de gatilhos durante importação em massa de planilhas ou migração de banco antigo.',
          breakdownItems: [
            {
              label: 'Desabilitar Gatilho Específico',
              description: 'ALTER TRIGGER trg_nome DISABLE;',
            },
            {
              label: 'Desabilitar Todos os Gatilhos de uma Tabela',
              description: 'ALTER TABLE pedidos DISABLE ALL TRIGGERS;',
            },
          ],
        },
      },
    ],
    usageExample: {
      title: 'Trigger BEFORE de Padronização e Bloqueio de Valor Inválido',
      explanation:
        'Garante que descrições de produtos sejam sempre gravadas sem espaços sobrando e em letras maiúsculas, barrando preços zerados ou negativos.',
      sql: `CREATE OR REPLACE TRIGGER trg_produtos_biu_valida
BEFORE INSERT OR UPDATE ON produtos
FOR EACH ROW
BEGIN
    -- Padroniza texto diretamente no pseudo-registro :NEW antes de gravar:
    :NEW.descricao := UPPER(TRIM(:NEW.descricao));

    -- Validação defensiva de regra de negócio:
    IF :NEW.preco_unit <= 0 THEN
        RAISE_APPLICATION_ERROR(-20001, 'O preco unitario do produto deve ser maior que zero.');
    END IF;
END;
/`,
    },
    ddlScript: `-- ==========================================================
-- DDL EXCLUSIVO DO MÓDULO 5 (AUDITORIA + TRIGGERS)
-- ==========================================================
CREATE TABLE auditoria_pedidos (
    id_auditoria  NUMBER        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_pedido     NUMBER,
    acao          VARCHAR2(20)  NOT NULL,
    valor_antigo  NUMBER(10,2),
    valor_novo    NUMBER(10,2),
    usuario_bd    VARCHAR2(50)  DEFAULT USER,
    maquina_os    VARCHAR2(100),
    data_evento   DATE          DEFAULT SYSDATE
);

-- 1. Trigger AFTER Condicional (INSERT, UPDATE e DELETE em um só objeto)
CREATE OR REPLACE TRIGGER trg_pedidos_auditoria
AFTER INSERT OR UPDATE OR DELETE ON pedidos
FOR EACH ROW
DECLARE
    v_maquina VARCHAR2(100);
BEGIN
    v_maquina := SYS_CONTEXT('USERENV', 'HOST');

    IF INSERTING THEN
        INSERT INTO auditoria_pedidos (id_pedido, acao, valor_antigo, valor_novo, usuario_bd, maquina_os)
        VALUES (:NEW.id_pedido, 'INSERCAO', NULL, :NEW.valor, USER, v_maquina);

    ELSIF UPDATING THEN
        INSERT INTO auditoria_pedidos (id_pedido, acao, valor_antigo, valor_novo, usuario_bd, maquina_os)
        VALUES (:NEW.id_pedido, 'ALTERACAO', :OLD.valor, :NEW.valor, USER, v_maquina);

    ELSIF DELETING THEN
        INSERT INTO auditoria_pedidos (id_pedido, acao, valor_antigo, valor_novo, usuario_bd, maquina_os)
        VALUES (:OLD.id_pedido, 'EXCLUSAO', :OLD.valor, NULL, USER, v_maquina);
    END IF;
END;
/

-- 2. Trigger Proposital de TABELA MUTANTE (Para demonstração do ORA-04091)
CREATE OR REPLACE TRIGGER trg_pedidos_mutante_demo
BEFORE UPDATE ON pedidos
FOR EACH ROW
DECLARE
    v_qtd_pedidos NUMBER;
BEGIN
    -- ERRO PROPOSITAL: Consultar a própria tabela PEDIDOS dentro de FOR EACH ROW!
    SELECT COUNT(1)
      INTO v_qtd_pedidos
      FROM pedidos
     WHERE id_cliente = :NEW.id_cliente;
END;
/

-- Deixe desabilitada inicialmente até o momento da demonstração ao vivo:
ALTER TRIGGER trg_pedidos_mutante_demo DISABLE;`,
    dmlScript: `-- ==========================================================
-- DML EXCLUSIVO DO MÓDULO 5 - MASSA DE TESTE DE AUDITORIA
-- ==========================================================
-- Dispara o ramo IF INSERTING da trigger de auditoria:
INSERT INTO pedidos (id_pedido, id_cliente, valor, status_pedido, data_pedido)
VALUES (201, 1, 1750.00, 'ABERTO', SYSDATE);

-- Dispara o ramo ELSIF UPDATING (registra valor_antigo = 1750 e valor_novo = 1990):
UPDATE pedidos
   SET valor = 1990.00
 WHERE id_pedido = 201;

-- Dispara o ramo ELSIF DELETING (registra valor_antigo = 1990 e valor_novo = NULL):
DELETE FROM pedidos
 WHERE id_pedido = 201;

COMMIT;`,
    exercise: {
      title: 'Auditoria Completa, Provocação do ORA-04091 e Controle Enable/Disable',
      scenario:
        'Vamos validar os logs gravados pela trigger condicional de auditoria, provocar ao vivo o erro clássico de Tabela Mutante (ORA-04091) e neutralizar o gatilho defeituoso sem perdê-lo.',
      tasks: [
        'Rode o DDL e o DML deste módulo e consulte a tabela auditoria_pedidos para conferir os 3 eventos (INSERCAO, ALTERACAO e EXCLUSAO).',
        'Habilite a trigger trg_pedidos_mutante_demo (ALTER TRIGGER ... ENABLE) e tente executar um UPDATE qualquer na tabela pedidos para observar o erro ORA-04091.',
        'Desabilite novamente a trigger mutante e confira o status de todas as triggers da tabela na view USER_TRIGGERS.',
      ],
      solutionSql: `-- Passo 1: Conferindo o rastro completo na auditoria
SELECT id_auditoria, id_pedido, acao, valor_antigo, valor_novo, usuario_bd, data_evento
  FROM auditoria_pedidos
 ORDER BY id_auditoria;

-- Passo 2: Habilitando a trigger defeituosa e provocando Tabela Mutante ao vivo
ALTER TRIGGER trg_pedidos_mutante_demo ENABLE;

-- Este UPDATE vai estourar: ORA-04091: table USR_TREINAMENTO.PEDIDOS is mutating
UPDATE pedidos SET valor = valor + 10 WHERE id_pedido = 101;

-- Passo 3: Desabilitando a trigger problemática para destravar a operação
ALTER TRIGGER trg_pedidos_mutante_demo DISABLE;

-- Agora o UPDATE volta a funcionar normalmente e é auditado pela trg_pedidos_auditoria!
UPDATE pedidos SET valor = valor + 10 WHERE id_pedido = 101;
COMMIT;

-- Passo 4: Consultando o status (ENABLED / DISABLED) no dicionário Oracle
SELECT trigger_name, trigger_type, triggering_event, status
  FROM user_triggers
 WHERE table_name = 'PEDIDOS';`,
      notes:
        'Mostre que também é possível desabilitar/habilitar TODAS as triggers de uma tabela de uma vez com: ALTER TABLE pedidos DISABLE ALL TRIGGERS; e ALTER TABLE pedidos ENABLE ALL TRIGGERS;',
    },
    instructorTips: [
      'Jamais coloque COMMIT ou ROLLBACK dentro de uma Trigger comum (gera erro ORA-04092, pois a trigger deve participar da mesma transação do comando pai).',
      'No PL/SQL Developer, mostre o ícone da engrenagem/gatilho com bolinha vermelha ou cinza na pasta Triggers indicando erro de compilação ou trigger desabilitada.',
    ],
  },
];

export const BRIDGE_SUGGESTIONS: BridgeSuggestion[] = [
  {
    id: 'bridge-explain-plan',
    recommendedAfterModuleId: 'mod-plsqldev',
    connectsLabel: 'Ponte Módulo 1 → Módulo 2 (IDE para SQL)',
    rationale:
      'Aproveita que os alunos estão configurando o PL/SQL Developer para ensinar o atalho F5 (Explain Plan), conectando a ferramenta à escrita consciente de filtros SQL.',
    moduleData: {
      id: 'mod-bridge-explain',
      title: 'Plano de Execução Rápido (F5 Explain Plan) e Índices',
      shortTitle: 'Explain Plan (F5)',
      durationMinutes: 10,
      category: 'Performance SQL',
      isCustom: true,
      conceptSummary:
        'Antes de rodar uma consulta pesada em produção, o atalho F5 no PL/SQL Developer exibe o Plano de Execução estimado pelo otimizador do Oracle, revelando se o banco fará leitura integral da tabela (TABLE ACCESS FULL) ou busca direta via índice (INDEX UNIQUE/RANGE SCAN).',
      keyPoints: [
        {
          title: 'Atalho F5 no PL/SQL Developer',
          pathOrSyntax: 'Selecionar SELECT > Pressionar F5',
          detail:
            'Mostra árvore de operações, custo (Cost) e cardinalidade estimada sem precisar executar a query até o fim.',
          deepDive: {
            purpose:
              'Avaliar o caminho escolhido pelo otimizador de custos (CBO) antes de submeter uma consulta que possa travar o servidor.',
            breakdownItems: [
              {
                label: 'TABLE ACCESS FULL',
                description: 'Lê todos os blocos de dados da tabela sequencialmente. Lento para tabelas com milhões de linhas.',
              },
              {
                label: 'INDEX RANGE SCAN / UNIQUE SCAN',
                description: 'Acessa a árvore B-Tree do índice e vai direto aos ponteiros ROWID desejados.',
              },
            ],
          },
        },
        {
          title: 'Funções na Coluna Indexada Inibem Índice Padrão',
          pathOrSyntax: 'Evitar: WHERE TRUNC(data_pedido) = ...',
          detail:
            'Aplicar funções sobre a coluna filtrada impede o uso de índice convencional; prefira intervalos de data (BETWEEN).',
        },
      ],
      usageExample: {
        title: 'Comparando Full Scan vs Index Scan no F5',
        explanation:
          'Criamos um índice na chave estrangeira id_cliente da tabela pedidos e comparamos o plano de acesso no F5.',
        sql: `-- Busca por PK (usa INDEX UNIQUE SCAN em PK_CLIENTES):
SELECT * FROM clientes WHERE id_cliente = 1;

-- Criando índice para acelerar joins e filtros por cliente em PEDIDOS:
CREATE INDEX idx_pedidos_cliente ON pedidos (id_cliente);

-- Pressione F5 sobre a consulta abaixo no PL/SQL Developer:
SELECT * FROM pedidos WHERE id_cliente = 1;`,
      },
      ddlScript: `CREATE INDEX idx_pedidos_cliente ON pedidos (id_cliente);`,
      dmlScript: `-- Sem necessidade de carga extra: utiliza registros atuais de PEDIDOS.`,
      exercise: {
        title: 'Inspeção de Custo com F5',
        scenario:
          'Compare no Explain Plan Window (F5) a diferença entre buscar um cliente pela chave primária ID_CLIENTE versus buscar pelo EMAIL sem índice.',
        tasks: [
          'Abra a janela Explain Plan pressionando F5 em SELECT * FROM clientes WHERE id_cliente = 1;',
          'Pressione F5 em SELECT * FROM clientes WHERE email = \'contato@alfa.com.br\'; e identifique o TABLE ACCESS FULL.',
        ],
        solutionSql: `-- 1. Usa índice PK_CLIENTES (INDEX UNIQUE SCAN):
SELECT * FROM clientes WHERE id_cliente = 1;

-- 2. Faz leitura completa (TABLE ACCESS FULL) enquanto não houver índice:
SELECT * FROM clientes WHERE email = 'contato@alfa.com.br';`,
      },
      instructorTips: [
        'Em tabelas minúsculas de treino o otimizador às vezes escolhe FULL SCAN por caber em 1 bloco de memória — avise isso rapidamente para ninguém estranhar!',
      ],
    },
  },
  {
    id: 'bridge-null-notin',
    recommendedAfterModuleId: 'mod-ddl-dml',
    connectsLabel: 'Ponte Módulo 2 → Módulo 3 (Armadilha do NULL no NOT IN)',
    rationale:
      'Complementa perfeitamente o tópico de Subquery IN mostrando o perigo clássico de usar NOT IN quando há valores NULL na subconsulta e como tratar nulos com NVL.',
    moduleData: {
      id: 'mod-bridge-null-trap',
      title: 'Tratamento de NULL (NVL) e a Armadilha do NOT IN',
      shortTitle: 'NULL, NVL & NOT IN',
      durationMinutes: 10,
      category: 'Fundamentos SQL & Transações',
      isCustom: true,
      conceptSummary:
        'No Oracle, string vazia (\'\') é tratada exatamente como NULL, e qualquer comparação direta (= ou <>) com NULL resulta em DESCONHECIDO. Em uma cláusula WHERE codigo NOT IN (SELECT ...), se uma única linha da subconsulta retornar NULL, a consulta inteira retorna ZERO linhas!',
      keyPoints: [
        {
          title: 'Nunca use = NULL ou <> NULL',
          pathOrSyntax: 'Correto: IS NULL / IS NOT NULL / NVL(col, valor_padrao)',
          detail:
            'Use NVL(coluna, 0) para substituir nulos em cálculos aritméticos (pois 100 + NULL resulta em NULL).',
        },
        {
          title: 'Segurança no NOT IN',
          pathOrSyntax: 'WHERE id NOT IN (SELECT id FROM tab WHERE id IS NOT NULL)',
          detail:
            'Sempre filtre IS NOT NULL dentro da subconsulta do NOT IN ou utilize NOT EXISTS.',
        },
      ],
      usageExample: {
        title: 'Demonstração ao Vivo da Armadilha do NOT IN com NULL',
        explanation:
          'Mostra como um único NULL no conjunto do NOT IN zera todo o retorno da query e como corrigir em segundos.',
        sql: `-- Retorna 0 linhas por causa do NULL na lista!
SELECT * FROM clientes WHERE id_cliente NOT IN (1, 3, NULL);

-- Forma segura filtrando nulos na subconsulta:
SELECT *
  FROM clientes
 WHERE id_cliente NOT IN (
       SELECT id_cliente
         FROM pedidos
        WHERE id_cliente IS NOT NULL
 );`,
      },
      exercise: {
        title: 'Listando Clientes Sem Nenhum Pedido',
        scenario:
          'O time comercial quer ligar para os clientes cadastrados que nunca fizeram nenhum pedido na base.',
        tasks: [
          'Monte uma consulta retornando todos os clientes que NÃO estão na tabela pedidos de forma segura contra valores nulos.',
          'Exiba também o e-mail tratando nulos com NVL(email, \'SEM E-MAIL\').',
        ],
        solutionSql: `SELECT c.id_cliente,
       c.nome,
       NVL(c.email, 'SEM E-MAIL') AS email_tratado
  FROM clientes c
 WHERE c.id_cliente NOT IN (
       SELECT p.id_cliente
         FROM pedidos p
        WHERE p.id_cliente IS NOT NULL
 );`,
      },
      instructorTips: [
        'Esse exemplo sempre surpreende iniciantes e evita bugs silenciosos em relatórios financeiros.',
      ],
    },
  },
  {
    id: 'bridge-exceptions',
    recommendedAfterModuleId: 'mod-plsql',
    connectsLabel: 'Ponte Módulo 4 → Módulo 5 (Exceções e Erros Customizados)',
    rationale:
      'Prepara o terreno entre Functions/Procedures e Triggers ensinando como capturar erros inesperados (NO_DATA_FOUND, TOO_MANY_ROWS) e devolver mensagens claras ao usuário com RAISE_APPLICATION_ERROR.',
    moduleData: {
      id: 'mod-bridge-exceptions',
      title: 'Tratamento de Exceções e RAISE_APPLICATION_ERROR',
      shortTitle: 'Exceções PL/SQL',
      durationMinutes: 10,
      category: 'Programação PL/SQL',
      isCustom: true,
      conceptSummary:
        'Em PL/SQL, um SELECT ... INTO exige que exatamente 1 linha seja retornada: zero linhas dispara NO_DATA_FOUND e duas ou mais linhas dispara TOO_MANY_ROWS. Já o procedimento RAISE_APPLICATION_ERROR(-20000 a -20999, msg) permite abortar transações com mensagens amigáveis para o ERP/sistema.',
      keyPoints: [
        {
          title: 'Faixa Reservada ao Desenvolvedor',
          pathOrSyntax: 'RAISE_APPLICATION_ERROR(-20001, \'Mensagem de negocio\');',
          detail:
            'Códigos entre -20000 e -20999 são reservados pelo Oracle para regras de negócio da empresa.',
        },
        {
          title: 'SQLERRM e SQLCODE em WHEN OTHERS',
          pathOrSyntax: 'WHEN OTHERS THEN ... SQLERRM',
          detail:
            'Permite registrar a mensagem técnica exata em tabelas de log antes de relançar o erro (RAISE).',
        },
      ],
      usageExample: {
        title: 'Bloco Seguro Tratando 0 Linhas, Múltiplas Linhas e Regra Customizada',
        explanation:
          'Busca um pedido específico de um cliente tratando todos os cenários possíveis de falha.',
        sql: `DECLARE
    v_valor pedidos.valor%TYPE;
BEGIN
    SELECT valor
      INTO v_valor
      FROM pedidos
     WHERE id_cliente = 1; -- Cliente 1 tem mais de 1 pedido -> TOO_MANY_ROWS!

    DBMS_OUTPUT.PUT_LINE('Valor encontrado: ' || v_valor);
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        DBMS_OUTPUT.PUT_LINE('Aviso: Cliente nao possui pedidos.');
    WHEN TOO_MANY_ROWS THEN
        DBMS_OUTPUT.PUT_LINE('Atencao: Cliente possui multiplos pedidos; refine o filtro!');
END;
/`,
      },
      exercise: {
        title: 'Bloqueando Exclusão de Pedido Faturado',
        scenario:
          'Crie uma Procedure prc_exclui_pedido(p_id_pedido) que impeça excluir pedidos com status FATURADO disparando erro -20010.',
        tasks: [
          'Consulte o status_pedido antes de excluir.',
          'Se for FATURADO, dispare RAISE_APPLICATION_ERROR(-20010, \'Pedido faturado nao pode ser excluido!\').',
        ],
        solutionSql: `CREATE OR REPLACE PROCEDURE prc_exclui_pedido (p_id_pedido IN NUMBER) IS
    v_status pedidos.status_pedido%TYPE;
BEGIN
    SELECT status_pedido INTO v_status FROM pedidos WHERE id_pedido = p_id_pedido;

    IF v_status = 'FATURADO' THEN
        RAISE_APPLICATION_ERROR(-20010, 'Bloqueado: Pedido faturado nao pode ser excluido!');
    END IF;

    DELETE FROM pedidos WHERE id_pedido = p_id_pedido;
    COMMIT;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20011, 'Pedido informado nao existe na base.');
END;
/`,
      },
      instructorTips: [
        'Conecta diretamente ao Módulo 5, onde usamos RAISE_APPLICATION_ERROR dentro de Triggers BEFORE para cancelar gravações inválidas.',
      ],
    },
  },
  {
    id: 'bridge-sequences',
    recommendedAfterModuleId: 'mod-triggers',
    connectsLabel: 'Complemento Módulo 5 (Padrão Corporativo Sequence + Trigger)',
    rationale:
      'Embora o Oracle 12c/18c tenha colunas IDENTITY, 90% dos sistemas legados Oracle em empresas usam o par clássico SEQUENCE + Trigger BEFORE INSERT para auto-incremento.',
    moduleData: {
      id: 'mod-bridge-sequence',
      title: 'Auto-Incremento Clássico: Sequence + Trigger BEFORE INSERT',
      shortTitle: 'Sequence + Trigger ID',
      durationMinutes: 10,
      category: 'Triggers & Regras de Banco',
      isCustom: true,
      conceptSummary:
        'Em bases corporativas Oracle criadas antes do 12c (e mantidas até hoje no 18c/19c), chaves primárias sequenciais são geradas combinando um objeto SEQUENCE independente com uma Trigger BEFORE INSERT que preenche :NEW.id automaticamente quando o valor vem nulo.',
      keyPoints: [
        {
          title: 'NEXTVAL vs CURRVAL',
          pathOrSyntax: 'seq_exemplo.NEXTVAL | seq_exemplo.CURRVAL',
          detail:
            'NEXTVAL avança e entrega o próximo número único; CURRVAL lê o último número gerado na sessão atual.',
        },
        {
          title: 'Preenchimento Condicional no :NEW',
          pathOrSyntax: 'IF :NEW.id IS NULL THEN :NEW.id := seq.NEXTVAL; END IF;',
          detail:
            'Permite que o sistema omita o ID no INSERT e receba a chave automaticamente sem conflito.',
        },
      ],
      usageExample: {
        title: 'Padrão Corporativo Tabela + Sequence + Trigger BI',
        explanation:
          'Estrutura clássica que os iniciantes certamente encontrarão ao dar manutenção em qualquer ERP Oracle.',
        sql: `CREATE SEQUENCE seq_chamados START WITH 1000 INCREMENT BY 1 NOCACHE;

CREATE TABLE chamados_suporte (
    id_chamado NUMBER PRIMARY KEY,
    titulo     VARCHAR2(100) NOT NULL,
    criado_em  DATE DEFAULT SYSDATE
);

CREATE OR REPLACE TRIGGER trg_chamados_bi
BEFORE INSERT ON chamados_suporte
FOR EACH ROW
BEGIN
    IF :NEW.id_chamado IS NULL THEN
        :NEW.id_chamado := seq_chamados.NEXTVAL;
    END IF;
END;
/`,
      },
      ddlScript: `CREATE SEQUENCE seq_chamados START WITH 1000 INCREMENT BY 1 NOCACHE;

CREATE TABLE chamados_suporte (
    id_chamado NUMBER PRIMARY KEY,
    titulo     VARCHAR2(100) NOT NULL,
    criado_em  DATE DEFAULT SYSDATE
);

CREATE OR REPLACE TRIGGER trg_chamados_bi
BEFORE INSERT ON chamados_suporte
FOR EACH ROW
BEGIN
    IF :NEW.id_chamado IS NULL THEN
        :NEW.id_chamado := seq_chamados.NEXTVAL;
    END IF;
END;
/`,
      dmlScript: `INSERT INTO chamados_suporte (titulo) VALUES ('Erro ao emitir nota fiscal');
INSERT INTO chamados_suporte (titulo) VALUES ('Liberacao de acesso novo colaborador');
COMMIT;`,
      exercise: {
        title: 'Testando Inserção Sem Informar a PK',
        scenario:
          'Insira dois chamados sem passar a coluna ID_CHAMADO e confira a numeração automática iniciada em 1000.',
        tasks: [
          'Rode o DDL e o DML acima.',
          'Consulte os registros em chamados_suporte e verifique o próximo valor da sequence.',
        ],
        solutionSql: `SELECT * FROM chamados_suporte ORDER BY id_chamado;

-- Consultando o valor atual da sequence na sessão:
SELECT seq_chamados.CURRVAL AS ultimo_id_gerado FROM dual;`,
      },
      instructorTips: [
        'Aproveite para explicar rapidinho a tabela mágica DUAL do Oracle (SELECT SYSDATE FROM dual;).',
      ],
    },
  },
];

export const INITIAL_BRAINSTORM_IDEAS: BrainstormIdea[] = [
  {
    id: 'idea-tnsnames',
    text: 'Mostrar como configura e para que serve o TNSNAMES.ora (arquivo de rede, alias XEPDB1, porta 1521 e tnsping)',
    targetModuleId: 'mod-setup',
    status: 'incorporado',
    createdAt: '04/11/2026',
  },
  {
    id: 'idea-dicionarios',
    text: 'Consultas de dicionarios próprios do ORACLE: all_tab_cols, all_views, user_tables, user_source, all_source',
    targetModuleId: 'mod-views',
    status: 'incorporado',
    createdAt: '04/11/2026',
  },
  {
    id: 'idea-1',
    text: 'Demonstrar o atalho F8 (Executar SQL sob o cursor) e o Beautifier (formatador de código PL/SQL) no Módulo 1.',
    targetModuleId: 'mod-plsqldev',
    status: 'pendente',
    createdAt: '04/11/2026',
  },
  {
    id: 'idea-2',
    text: 'Lembrar de comentar sobre a tabela DUAL do Oracle (ex: SELECT SYSDATE, USER FROM dual;) antes do Módulo 4.',
    targetModuleId: 'mod-ddl-dml',
    status: 'pendente',
    createdAt: '04/11/2026',
  },
  {
    id: 'idea-3',
    text: 'Mostrar no navegador lateral do PL/SQL Developer como identificar objetos inválidos (ícone com X vermelho) e usar Compile Invalid Objects.',
    targetModuleId: 'mod-triggers',
    status: 'pendente',
    createdAt: '04/11/2026',
  },
];

export const DEFAULT_SCRATCHPAD_TEXT = `- Lembrar de mostrar o arquivo tnsnames.ora na pasta %ORACLE_HOME%\\network\\admin e rodar 'tnsping XEPDB1' no CMD.
- Mostrar a consulta em USER_TAB_COLS para achar colunas em tabelas sem diagrama.
- Reforçar o perigo dos privilégios ANY (CREATE ANY TABLE, DROP ANY TABLE) em produção.
- Reforçar por que o erro ORA-01950 (falta de cota) só ocorre no INSERT e não no CREATE TABLE.
- Explicar como o USER_SOURCE serve de 'Ctrl+F' para achar regras de negócio em procedures e triggers.`;

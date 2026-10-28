/*
  Gates synthetic SQL Server fixture — local restore testing only.

  Unique names (do not change without updating LOCAL_RESTORE_TEST.md):
    Source database : GatesSyntheticSrc
    Backup file     : C:\GatesMigrationTest\GSyn251025T1.bak
    Agent restore DB: GatesAgentRestore_GSyn251025T1
                      (agent takes the bak basename, strips non-alphanumerics,
                       keeps 16 chars, prefixes GatesAgentRestore_)
    SQL login       : gates_mig_test   (never sa)

  Safety:
    - Aborts if GatesSyntheticSrc or GatesAgentRestore_GSyn251025T1 already exist.
    - Aborts if the .bak path already exists (no INIT / FORMAT overwrite).
    - BACKUP uses COPY_ONLY so it does not touch any other database's restore chain.
    - No REPLACE. Do not drop GatesSyntheticSrc. The agent restores with
      FILELISTONLY + MOVE into GatesAgentRestore_GSyn251025T1.

  Run from PowerShell (not as Administrator unless creating C:\GatesMigrationTest):

    $env:SQLCMDPASSWORD = "<local sql login password for a sysadmin used ONLY to create the fixture>"
    sqlcmd -S localhost -U <fixture_admin_not_needed_after_setup> -C -i SYNTHETIC_SQL_TEST.sql
    Remove-Item Env:SQLCMDPASSWORD

  Or Windows Authentication on a local Developer instance:

    sqlcmd -S localhost -E -C -i SYNTHETIC_SQL_TEST.sql `
      -v TestLoginPassword="your-local-only-password"

  Do not run this against production or customer servers.
*/

:setvar SourceDb GatesSyntheticSrc
:setvar RestoreDb GatesAgentRestore_GSyn251025T1
:setvar BakPath C:\GatesMigrationTest\GSyn251025T1.bak
:setvar DataDir C:\GatesMigrationTest\data
:setvar TestLogin gates_mig_test
:setvar TestLoginPassword SET_A_LOCAL_PASSWORD
:setvar CompanyCode 0001

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* -------------------------------------------------------------------------- */
/* Section A — refuse to overwrite anything that already exists               */
/* -------------------------------------------------------------------------- */
USE [master];
GO

IF N'$(TestLoginPassword)' IN (N'SET_A_LOCAL_PASSWORD', N'')
BEGIN
  THROW 50001, 'Set sqlcmd variable TestLoginPassword to a local-only password. Do not use sa.', 1;
END;

IF DB_ID(N'$(SourceDb)') IS NOT NULL
BEGIN
  THROW 50002, 'GatesSyntheticSrc already exists. Refusing to overwrite. Pick a new unique name or drop only this synthetic database after you confirm it is ours.', 1;
END;

IF DB_ID(N'$(RestoreDb)') IS NOT NULL
BEGIN
  THROW 50003, 'GatesAgentRestore_GSyn251025T1 already exists. The agent will not overwrite it either. Stop.', 1;
END;

IF EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'$(TestLogin)')
BEGIN
  THROW 50004, 'Login gates_mig_test already exists. Refusing to alter it. Drop it only if you created it for this test.', 1;
END;

/* xp_fileexist: 1 = file exists. Abort so we never INIT/overwrite a bak. */
DECLARE @bakExists INT;
DECLARE @bakDir TABLE (file_exists INT, file_is_dir INT, parent_dir_exists INT);
INSERT INTO @bakDir
EXEC master.dbo.xp_fileexist N'$(BakPath)';
SELECT @bakExists = file_exists FROM @bakDir;
IF @bakExists = 1
BEGIN
  THROW 50005, 'Backup file C:\GatesMigrationTest\GSyn251025T1.bak already exists. Refusing to overwrite. Use a new unique filename.', 1;
END;
GO

/* -------------------------------------------------------------------------- */
/* Section B — create the synthetic source database with unique file names    */
/* Operator must create C:\GatesMigrationTest\data first (see the Windows     */
/* guide). SQL Server service account must be able to create files there.     */
/* -------------------------------------------------------------------------- */
CREATE DATABASE [$(SourceDb)]
ON PRIMARY
(
  NAME = N'GatesSyntheticSrc_dat',
  FILENAME = N'$(DataDir)\GatesSyntheticSrc.mdf',
  SIZE = 16MB,
  FILEGROWTH = 8MB
)
LOG ON
(
  NAME = N'GatesSyntheticSrc_log',
  FILENAME = N'$(DataDir)\GatesSyntheticSrc_log.ldf',
  SIZE = 8MB,
  FILEGROWTH = 8MB
);
GO

ALTER DATABASE [$(SourceDb)] SET RECOVERY SIMPLE;
GO

USE [$(SourceDb)];
GO

/*
  Minimal legacy-shaped tables so connector COUNT / DISCOVER_SCHEMA and a later
  FOUNDATION analyze can see rows. This is not a Delphi dump and is not a
  customer database. Empty shells exist so missing-table errors are not confused
  with restore failures.
*/
CREATE TABLE dbo.Branch (
  CompanyCode   VARCHAR(10)  NOT NULL,
  BranchCode    VARCHAR(20)  NOT NULL,
  BranchNameA   NVARCHAR(100) NULL,
  BranchNameE   NVARCHAR(100) NULL,
  Address       NVARCHAR(200) NULL,
  Street        NVARCHAR(100) NULL,
  Building      NVARCHAR(50)  NULL,
  City          NVARCHAR(50)  NULL,
  CountryCode   VARCHAR(10)  NULL,
  StateName     NVARCHAR(50)  NULL,
  Place         NVARCHAR(50)  NULL,
  ActivityCode  VARCHAR(20)  NULL,
  PriceListCode VARCHAR(20)  NULL,
  BarCodePrice  VARCHAR(20)  NULL,
  TaxOfficeCode VARCHAR(20)  NULL,
  CONSTRAINT PK_Branch PRIMARY KEY (CompanyCode, BranchCode)
);

CREATE TABLE dbo.[Year] (
  CompanyCode VARCHAR(10)  NOT NULL,
  YearCode    VARCHAR(10)  NOT NULL,
  YearID      VARCHAR(10)  NULL,
  YearNameA   NVARCHAR(50)  NULL,
  YearNameE   NVARCHAR(50)  NULL,
  FromDate    DATETIME      NULL,
  ToDate      DATETIME      NULL,
  Status      VARCHAR(20)  NULL,
  CONSTRAINT PK_Year PRIMARY KEY (CompanyCode, YearCode)
);

CREATE TABLE dbo.Currency (
  CompanyCode   VARCHAR(10)  NOT NULL,
  CurrencyCode  VARCHAR(10)  NOT NULL,
  CurrencyNameA NVARCHAR(50)  NULL,
  CurrencyNameE NVARCHAR(50)  NULL,
  Change        DECIMAL(18, 6) NULL,
  CONSTRAINT PK_Currency PRIMARY KEY (CompanyCode, CurrencyCode)
);

CREATE TABLE dbo.CostCenter (
  CompanyCode    VARCHAR(10)  NOT NULL,
  CCenterCode    VARCHAR(20)  NOT NULL,
  CCenterNameA   NVARCHAR(100) NULL,
  CCenterNameE   NVARCHAR(100) NULL,
  CONSTRAINT PK_CostCenter PRIMARY KEY (CompanyCode, CCenterCode)
);

CREATE TABLE dbo.Store (
  CompanyCode VARCHAR(10)  NOT NULL,
  StoreCode   VARCHAR(20)  NOT NULL,
  BranchCode  VARCHAR(20)  NULL,
  StoreNameA  NVARCHAR(100) NULL,
  StoreNameE  NVARCHAR(100) NULL,
  CONSTRAINT PK_Store PRIMARY KEY (CompanyCode, StoreCode)
);

CREATE TABLE dbo.CompanySetting (
  CompanyCode    VARCHAR(10)  NOT NULL,
  BranchCode     VARCHAR(20)  NOT NULL,
  Name           VARCHAR(100) NOT NULL,
  Value          NVARCHAR(200) NULL,
  AdditionalData NVARCHAR(200) NULL,
  CONSTRAINT PK_CompanySetting PRIMARY KEY (CompanyCode, BranchCode, Name)
);

CREATE TABLE dbo.CurrencyHistory (
  CompanyCode  VARCHAR(10) NOT NULL,
  CurrencyCode VARCHAR(10) NOT NULL,
  Change       DECIMAL(18, 6) NULL,
  [Date]       DATETIME NULL
);

CREATE TABLE dbo.Account (
  CompanyCode   VARCHAR(10) NOT NULL,
  AccountCode   VARCHAR(30) NOT NULL,
  ParentAccount VARCHAR(30) NULL,
  AccountNameA  NVARCHAR(100) NULL,
  AccountNameE  NVARCHAR(100) NULL,
  AccountType   VARCHAR(20) NULL,
  CurrencyCode  VARCHAR(10) NULL,
  Deleted       VARCHAR(5) NULL
);
CREATE TABLE dbo.Accounts (
  CompanyCode  VARCHAR(10) NOT NULL,
  AccountCode  VARCHAR(30) NOT NULL,
  AccountNameA NVARCHAR(100) NULL
);
CREATE TABLE dbo.Customer (
  CompanyCode  VARCHAR(10) NOT NULL,
  CustomerCode VARCHAR(30) NOT NULL,
  CustomerNameA NVARCHAR(100) NULL,
  BranchCode   VARCHAR(20) NULL
);
CREATE TABLE dbo.Supplier (
  CompanyCode  VARCHAR(10) NOT NULL,
  SupplierCode VARCHAR(30) NOT NULL,
  SupplierNameA NVARCHAR(100) NULL,
  BranchCode   VARCHAR(20) NULL
);
CREATE TABLE dbo.GLTrxHeader (
  CompanyCode VARCHAR(10) NOT NULL,
  BranchCode  VARCHAR(20) NOT NULL,
  YearID      VARCHAR(10) NOT NULL,
  GlNum       VARCHAR(20) NOT NULL
);
CREATE TABLE dbo.GLTrxDetail (
  CompanyCode VARCHAR(10) NOT NULL,
  BranchCode  VARCHAR(20) NOT NULL,
  YearID      VARCHAR(10) NOT NULL,
  GLNum       VARCHAR(20) NOT NULL
);
CREATE TABLE dbo.BalanceAccountsH (CompanyCode VARCHAR(10) NOT NULL);
CREATE TABLE dbo.BalanceAccountsD (CompanyCode VARCHAR(10) NOT NULL);
CREATE TABLE dbo.InvoiceTrxHeader (CompanyCode VARCHAR(10) NOT NULL, BranchCode VARCHAR(20) NULL, YearID VARCHAR(10) NULL, Type VARCHAR(10) NULL, InvoiceNum VARCHAR(20) NULL);
CREATE TABLE dbo.InvoiceTrxDetail (CompanyCode VARCHAR(10) NOT NULL, BranchCode VARCHAR(20) NULL, YearID VARCHAR(10) NULL, Type VARCHAR(10) NULL, InvoiceNum VARCHAR(20) NULL);
CREATE TABLE dbo.Item (CompanyCode VARCHAR(10) NOT NULL, ItemCode VARCHAR(30) NOT NULL);
CREATE TABLE dbo.ItemUnit (CompanyCode VARCHAR(10) NOT NULL, ItemCode VARCHAR(30) NOT NULL);
CREATE TABLE dbo.ItemStore (CompanyCode VARCHAR(10) NOT NULL, ItemCode VARCHAR(30) NOT NULL, StoreCode VARCHAR(20) NULL);
CREATE TABLE dbo.ItemGroup (CompanyCode VARCHAR(10) NOT NULL);
CREATE TABLE dbo.ItemUnitDef (CompanyCode VARCHAR(10) NOT NULL);
CREATE TABLE dbo.ItemCost (CompanyCode VARCHAR(10) NOT NULL);
CREATE TABLE dbo.CashTrxHeader (CompanyCode VARCHAR(10) NOT NULL, BranchCode VARCHAR(20) NULL, YearID VARCHAR(10) NULL, Type VARCHAR(10) NULL, CashNum VARCHAR(20) NULL);
CREATE TABLE dbo.CashTrxDetail (CompanyCode VARCHAR(10) NOT NULL);
CREATE TABLE dbo.CKTrxDetail (CompanyCode VARCHAR(10) NOT NULL);
CREATE TABLE dbo.CKTrxDetailSub (CompanyCode VARCHAR(10) NOT NULL);
CREATE TABLE dbo.PKTrxDetail (CompanyCode VARCHAR(10) NOT NULL);
CREATE TABLE dbo.PKTrxDetailSub (CompanyCode VARCHAR(10) NOT NULL);
CREATE TABLE dbo.SettlementTrxHeader (CompanyCode VARCHAR(10) NOT NULL);
CREATE TABLE dbo.InventoryMovement (CompanyCode VARCHAR(10) NOT NULL);
CREATE TABLE dbo.StoreCheckHeader (CompanyCode VARCHAR(10) NOT NULL);
CREATE TABLE dbo.BankBoxRights (CompanyCode VARCHAR(10) NOT NULL);

INSERT INTO dbo.Branch (CompanyCode, BranchCode, BranchNameA, City)
VALUES (N'$(CompanyCode)', N'01', N'فرع اختبار', N'Cairo');

INSERT INTO dbo.[Year] (CompanyCode, YearCode, YearID, YearNameA, FromDate, ToDate, Status)
VALUES (N'$(CompanyCode)', N'2026', N'2026', N'2026', '20260101', '20261231', N'Open');

INSERT INTO dbo.Currency (CompanyCode, CurrencyCode, CurrencyNameA, CurrencyNameE, Change)
VALUES (N'$(CompanyCode)', N'EGP', N'جنيه', N'EGP', 1);

INSERT INTO dbo.CostCenter (CompanyCode, CCenterCode, CCenterNameA)
VALUES (N'$(CompanyCode)', N'CC01', N'مركز تكلفة اختبار');

INSERT INTO dbo.Store (CompanyCode, StoreCode, BranchCode, StoreNameA)
VALUES (N'$(CompanyCode)', N'ST01', N'01', N'مخزن اختبار');

INSERT INTO dbo.CompanySetting (CompanyCode, BranchCode, Name, Value)
VALUES (N'$(CompanyCode)', N'01', N'SyntheticMarker', N'GatesSyntheticSrc');
GO

USE [master];
GO

CREATE LOGIN [$(TestLogin)] WITH PASSWORD = N'$(TestLoginPassword)', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF;
ALTER SERVER ROLE [dbcreator] ADD MEMBER [$(TestLogin)];
GO

USE [$(SourceDb)];
GO
CREATE USER [$(TestLogin)] FOR LOGIN [$(TestLogin)];
ALTER ROLE [db_datareader] ADD MEMBER [$(TestLogin)];
GO

USE [master];
GO

BACKUP DATABASE [$(SourceDb)]
TO DISK = N'$(BakPath)'
WITH COPY_ONLY, NOFORMAT, NOINIT, NAME = N'GatesSyntheticSrc-copy-only', STATS = 10;
GO

RESTORE HEADERONLY FROM DISK = N'$(BakPath)';
GO

SELECT
  N'$(SourceDb)' AS source_db,
  N'$(RestoreDb)' AS expected_agent_restore_db,
  N'$(BakPath)' AS bak_path,
  N'$(TestLogin)' AS test_login,
  N'synthetic fixture ready — restore not run' AS status;
GO

/*
  Do not RESTORE this bak into GatesAgentRestore_GSyn251025T1 here — leave that
  name free for the agent. Do not DROP GatesSyntheticSrc. The agent uses
  RESTORE FILELISTONLY and WITH MOVE onto the instance default data directory.
*/

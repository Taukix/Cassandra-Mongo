# Cassandra

## Lancement du conteneur Docker

Le fichier `docker-compose.yml` est disponible dans le repo. Une version pour les machines avec peu de RAM est également disponible : `docker-compose-low-ram.yml`.

```bash
docker-compose up -d
```

Il y a trois nœuds Cassandra distincts. Ils font tous partie du même cluster. Le premier nœud, `tb_cassandra1`, agit comme un nœud "seed" pour les deux autres.

Un nœud "seed" est un nœud de référence pour aider les nouveaux nœuds à rejoindre le cluster. Lorsqu'un nœud Cassandra démarre, il utilise les nœuds "seed" pour obtenir une liste des autres nœuds du cluster et comprendre la topologie globale du cluster. Bien que les nœuds "seed" aient un rôle spécial lors de la découverte et de la formation du cluster, ils ne sont pas des "maîtres" ou des nœuds privilégiés en termes de traitement des données. Une fois que le cluster est opérationnel, tous les nœuds, qu'ils soient "seed" ou non, fonctionnent de manière égale et distribuée.

`tb_cassandra1` est défini comme le nœud "seed", `tb_cassandra2` et `tb_cassandra3` le contacteront initialement pour obtenir des informations sur le reste du cluster lorsqu'ils démarreront.

La version low-ram n'a qu'un seul noeud.

## Utilisation de cqlsh

C'est un outil en ligne de commande pour intéragir avec Cassandra.

```bash
docker exec -it r510-tb_cassandra1-1 cqlsh
```

## Keyspaces

Un keyspace est similaire à une base de données dans les systèmes RDBMS (Relational Database Management System). Il contient les tables.

Créons deux keyspaces :
```sql
CREATE KEYSPACE tb_demo1 WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 3};
CREATE KEYSPACE tb_demo2 WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 3};
```

Si vous utilisez la version low-ram, utilisez un RF de 1.

L'option `WITH replication` définit la stratégie de réplication pour le keyspace. Dans cet exemple, nous utilisons SimpleStrategy avec un replication_factor de 3. Cela signifie que chaque donnée sera répliquée sur trois nœuds différents du cluster, garantissant ainsi une meilleure disponibilité et résilience des données.

SimpleStrategy est généralement recommandé pour les environnements de test ou les clusters à un seul centre de données. Dans un environnement de production, en particulier avec des clusters répartis sur plusieurs centres de données, il est recommandé d'utiliser NetworkTopologyStrategy. Il est conçu pour gérer la réplication de données dans des clusters multi-centres de données. Il permet de définir un facteur de réplication distinct pour chaque centre de données, garantissant ainsi que les données sont correctement répliquées à travers les centres de données, offrant à la fois une haute disponibilité et une résilience en cas de défaillance d'un centre de données entier.

## Tables (Column Families)

```sql
USE tb_demo1;
CREATE TABLE tb_cfdemo1 (
    tb_col1 UUID PRIMARY KEY,
    tb_col2 text,
    tb_col3 int
);

USE tb_demo2;
CREATE TABLE tb_cfdemo2 (
    tb_col1 UUID PRIMARY KEY,
    tb_col2 text,
    tb_col3 int
);
```

## Types de données

```sql
USE tb_demo1;

ALTER TABLE tb_cfdemo1 ADD tb_col4 set<text>;
ALTER TABLE tb_cfdemo1 ADD tb_col5 map<text, int>;
ALTER TABLE tb_cfdemo1 ADD tb_col6 tuple<text, int, float>;
```

```sql
INSERT INTO tb_cfdemo1 (tb_col1, tb_col2, tb_col3) VALUES (uuid(), 'test', 123);
```

## Collections et tuples

Les collections (listes, sets, maps) et les tuples permettent de stocker plusieurs valeurs dans une seule colonne.

Remplacer `<some_uuid>` par l'UUID inséré précédemment (voir avec un SELECT).

```sql
UPDATE tb_cfdemo1 SET tb_col4 = {'value1', 'value2'} WHERE tb_col1 = <some_uuid>;
UPDATE tb_cfdemo1 SET tb_col5 = {'key1': 1, 'key2': 2} WHERE tb_col1 = <some_uuid>;
UPDATE tb_cfdemo1 SET tb_col6 = ('tuple_value', 123, 1.23) WHERE tb_col1 = <some_uuid>;
```

## Types de données personnalisés

Il est possible de créer ses propres types de données dans Cassandra.

```sql
CREATE TYPE tb_custom_type (field1 text, field2 int);
ALTER TABLE tb_cfdemo1 ADD tb_col7 tb_custom_type;
```

## Clés primaires

Identifie de manière unique une ligne dans une table :
- Simple : une seule colonne
- Composite : plusieurs colonnes

La première colonne est la clé de partition, les colonnes suivantes sont les clés de clustering.

```sql
USE tb_demo2;

CREATE TABLE tb_cfdemo3 (
    tb_col1 text,
    tb_col2 int,
    tb_col3 float,
    PRIMARY KEY (tb_col1, tb_col2)
);
```

Ici, `tb_col1` est la clé de partition et `tb_col2` est la clé de clustering, formant une clé primaire composite.

## Clustering order

Le clustering order détermine l'ordre dans lequel les lignes sont stockées pour une clé de partition donnée.

```sql
CREATE TABLE tb_cfdemo4 (
    tb_col1 text,
    tb_col2 int,
    tb_col3 float,
    PRIMARY KEY (tb_col1, tb_col2)
) WITH CLUSTERING ORDER BY (tb_col2 DESC);
```

## Vues matérialisées

Par défaut, cette fonctionnalité est désactivée. Pour l'activer :

```bash
docker exec -it r510-tb_cassandra1-1 bash
sed -i 's/materialized_views_enabled: false/materialized_views_enabled: true/' /etc/cassandra/cassandra.yaml
exit
docker restart r510-tb_cassandra1-1
```

Une vue matérialisée est une table générée à partir d'une table existante et organisée différemment.

```sql
USE tb_demo1;
CREATE MATERIALIZED VIEW tb_mv AS
SELECT tb_col2, tb_col1, tb_col3
FROM tb_cfdemo1
WHERE tb_col2 IS NOT NULL
AND tb_col1 IS NOT NULL
PRIMARY KEY (tb_col2, tb_col1);
```

## Requêtes SELECT

Remplacer `<some_uuid>` par l'UUID inséré précédemment (voir avec un SELECT).

```sql
SELECT * FROM tb_cfdemo1 WHERE tb_col1 = <some_uuid>;
SELECT * FROM tb_cfdemo1 WHERE tb_col2 IN ('value1', 'value2') ALLOW FILTERING;
```

## Fonctions d'agrégation

```sql
SELECT COUNT(*), MAX(tb_col3), AVG(tb_col3), MIN(tb_col3), SUM(tb_col3) FROM tb_cfdemo1;
```

## Limit et ranges

```sql
SELECT * FROM tb_cfdemo1 LIMIT 5;
SELECT * FROM tb_cfdemo1 WHERE tb_col3 > 100 AND tb_col3 < 200 ALLOW FILTERING;
```

## Index

Pour accélérer les requêtes sur des colonnes non primaires.

```sql
CREATE INDEX ON tb_cfdemo1 (tb_col2);
```

## Allow filtering

`ALLOW FILTERING` permet d'exécuter des requêtes qui seraient inefficaces car elles nécessiteraient de scanner une grande partie de la table. C'est utile pour les requêtes sur des colonnes non indexées ou non primaires, mais cela peut être coûteux en termes de performances.

```sql
SELECT * FROM tb_cfdemo1 WHERE tb_col3 = 123 ALLOW FILTERING;
```

## Mise à jour et suppression de données

Remplacer `<some_uuid>` par l'UUID inséré précédemment (voir avec un SELECT).

```sql
UPDATE tb_cfdemo1 SET tb_col4 = tb_col4 + {'value3'} WHERE tb_col1 = <some_uuid>;
DELETE tb_col4['value1'] FROM tb_cfdemo1 WHERE tb_col1 = <some_uuid>;
```

## Index personnalisés et requêtes SASI

Par défaut, cette fonctionnalité est désactivée. Pour l'activer :

```bash
docker exec -it r510-tb_cassandra1-1 bash
sed -i 's/sasi_indexes_enabled: false/sasi_indexes_enabled: true/' /etc/cassandra/cassandra.yaml
exit
docker restart r510-tb_cassandra1-1
```

SASI (SStable Attached Secondary Index) est un type d'index secondaire pour Cassandra. Il offre des capacités de recherche avancées, comme la recherche par préfixe, suffixe et sous-chaîne.

```sql
USE tb_demo1;
CREATE CUSTOM INDEX ON tb_cfdemo1 (tb_col2) USING 'org.apache.cassandra.index.sasi.SASIIndex' WITH OPTIONS = {'mode': 'PREFIX', 'analyzer_class': 'org.apache.cassandra.index.sasi.analyzer.StandardAnalyzer', 'case_sensitive': 'false'};
CREATE CUSTOM INDEX ON tb_cfdemo1 (tb_col2) USING 'org.apache.cassandra.index.sasi.SASIIndex' WITH OPTIONS = {'mode': 'CONTAINS', 'analyzer_class': 'org.apache.cassandra.index.sasi.analyzer.StandardAnalyzer', 'case_sensitive': 'false'};
```

- `mode` : Le mode de recherche. CONTAINS est utile pour les recherches par sous-chaîne. PREFIX est utile pour les recherches par préfixe.
- `analyzer_class` : L'analyseur à utiliser. StandardAnalyzer est un analyseur général qui divise le texte en termes basés sur des espaces blancs et des signes de ponctuation.
- `case_sensitive`: Indique si la recherche doit être sensible à la casse ou non.

```sql
INSERT INTO tb_demo1.tb_cfdemo1 (tb_col1, tb_col2, tb_col3) VALUES (uuid(), 'test_prefix_suffix', 123);
INSERT INTO tb_demo1.tb_cfdemo1 (tb_col1, tb_col2, tb_col3) VALUES (uuid(), 'prefix_test_suffix', 456);
INSERT INTO tb_demo1.tb_cfdemo1 (tb_col1, tb_col2, tb_col3) VALUES (uuid(), 'prefix_suffix_test', 789);
```

Recherche par préfixe :

```sql
SELECT * FROM tb_demo1.tb_cfdemo1 WHERE tb_col2 LIKE 'test%';
```

Recherche par suffixe :

```sql
SELECT * FROM tb_demo1.tb_cfdemo1 WHERE tb_col2 LIKE '%test';
```

Recherche par sous-chaîne :

```sql
SELECT * FROM tb_demo1.tb_cfdemo1 WHERE tb_col2 LIKE '%test%';
```

## Nodetool et réparation

`nodetool` est un outil en ligne de commande pour gérer le Cassandra. Réparer une table signifie synchroniser les données entre les nœuds pour s'assurer qu'ils ont tous les mêmes données.

```bash
docker exec -it r510-tb_cassandra1-1 nodetool repair tb_demo1 tb_cfdemo1
```

## Gestion des nœuds et résilience (facultatif)

La suite n'est pas faisable si vous utilisez la version low-ram.

La résilience est la capacité d'un système à fonctionner et à se remettre des pannes. Dans le contexte de Cassandra, cela signifie que le système peut continuer à fonctionner même si certains nœuds tombent en panne.

On peut arrêter certains noeuds pour tester. Arrêtons les deuxième et troisième noeuds :

```bash
docker-compose stop r510-tb_cassandra2-1 r510-tb_cassandra3-1
```

Avec deux nœuds sur trois arrêtés, nous avons maintenant moins que le quorum de nœuds en fonctionnement car nous avons un facteur de réplication de 3.

Le quorum est un concept fondamental dans les systèmes distribués comme Cassandra. Il représente le nombre minimal de nœuds qui doivent confirmer la réception d'une opération pour que celle-ci soit considérée comme réussie. Dans le contexte de Cassandra, un quorum est généralement défini comme la majorité des réplicas pour une entrée spécifique. Ainsi, avec un facteur de réplication (RF) de 3, le quorum serait atteint avec 2 nœuds.

Lorsqu'on effectue des opérations d'insertion ou de sélection, on peut spécifier le niveau de cohérence qu'on souhaite. Le niveau de cohérence détermine combien de nœuds doivent répondre pour qu'une opération soit considérée comme réussie.

Pour comprendre comment les nœuds du cluster communiquent entre eux et comment ils comprennent la topologie du cluster, Cassandra utilise ce qu'on appelle un "snitch". Dans notre configuration, nous utilisons GossipingPropertyFileSnitch, qui détermine comment les nœuds sont répartis géographiquement et comment ils doivent communiquer. Cela influence également la manière dont les données sont répliquées à travers le cluster, ce qui est crucial pour le quorum et la résilience.

Essayons d'insérer une donnée en spécifiant un niveau de cohérence de QUORUM :

```sql
CONSISTENCY QUORUM;
INSERT INTO tb_demo1.tb_cfdemo1 (tb_col1, tb_col2, tb_col3) VALUES (uuid(), 'test_quorum', 456);
```

Et essayons de la récupérer :

```sql
CONSISTENCY QUORUM;
SELECT * FROM tb_demo1.tb_cfdemo1 WHERE tb_col2 = 'test_quorum' ALLOW FILTERING;
```

Avec seulement un nœud en fonctionnement, ces opérations échoueront car nous n'atteignons pas le quorum nécessaire. On aura une erreur indiquant que le niveau de cohérence requis n'a pas été atteint. Pour que ces opérations réussissent, au moins deux nœuds (le quorum pour un RF de 3) doivent être en ligne et fonctionnels.

Redémarrons l'un des noeuds :

```bash
docker-compose start r510-tb_cassandra2-1
```

Avec deux nœuds maintenant en fonctionnement, nous avons atteint le quorum nécessaire pour un RF de 3.

```sql
CONSISTENCY QUORUM;
INSERT INTO tb_demo1.tb_cfdemo1 (tb_col1, tb_col2, tb_col3) VALUES (uuid(), 'test_quorum_recovery', 789);
```

```sql
CONSISTENCY QUORUM;
SELECT * FROM tb_demo1.tb_cfdemo1 WHERE tb_col2 = 'test_quorum_recovery' ALLOW FILTERING;
```

Cette fois, les opérations devraient réussir car deux nœuds (le quorum pour un RF de 3) sont en ligne et fonctionnels. Cela démontre la capacité de Cassandra à se remettre des pannes et à continuer à fonctionner dès que le quorum est rétabli.

## Scripts

### [Java](https://github.com/carlodrift/cours-nosql/tree/main/cassandra/scripts/java)

Installer Java et Maven.

Se placer dans le dossier `cassandra/scripts/java`.

```bash
mvn compile && mvn exec:java
```

On peut aussi utiliser son IDE préféré à la place.

### [Python](https://github.com/carlodrift/cours-nosql/tree/main/cassandra/scripts/python)

Installer Python.

Se placer dans le dossier `cassandra/scripts/python`.

```bash
pip3 install cassandra-driver
python3 cassandra-script.py
```

### [JavaScript](https://github.com/carlodrift/cours-nosql/tree/main/cassandra/scripts/javascript)

Installer Node.

Se placer dans le dossier `cassandra/scripts/javascript`.

```bash
npm install cassandra-driver
node cassandra-script.js
```

### [Go](https://github.com/carlodrift/cours-nosql/tree/main/cassandra/scripts/go)

Installer [Go](https://go.dev/).

Se placer dans le dossier `cassandra/scripts/go`.

```bash
go get github.com/gocql/gocql
go run cassandra-script.go
```

## Glossaire

1. **Modèle de données** :
- **Clé de partition** : Détermine sur quel nœud une rangée de données sera stockée. Première partie de la clé primaire.
- **Clé de clustering** : Détermine l'ordre des données à l'intérieur d'une partition. Deuxième partie de la clé primaire 
- **Table** : Contient des rangées de données. Chaque rangée est identifiée par une clé primaire.
- **Espace de noms (Keyspace)** : Équivalent d'une base de données dans les systèmes RDBMS.
2. **Architecture distribuée** :
- **Nœud** : Une instance de Cassandra.
- **Cluster** : Un ensemble de nœuds.
- **Partitionnement** : Cassandra utilise une fonction de hachage pour distribuer les données à travers les nœuds. Détermine sur quel nœud une rangée sera stockée. La fonction de hachage transforme la clé de partition en un token qui détermine le nœud responsable de cette partition.
- **Réplication** : Les données sont répliquées sur plusieurs nœuds pour assurer la disponibilité et la résilience.
3. **Stratégie de réplication** :
- **SimpleStrategy** : Utilisée pour un seul centre de données.
- **NetworkTopologyStrategy** : Utilisée pour plusieurs centres de données.
4. **Consistance** :
- Cassandra offre une consistence éventuelle, ce qui signifie que les lectures peuvent ne pas refléter la dernière écriture.
- **Niveau de consistence** : Définit combien de nœuds doivent confirmer une lecture ou une écriture.
5. **Gossip Protocol** : Un protocole de communication entre les nœuds pour découvrir et partager l'état et l'information sur les autres nœuds.
6. **Index** :
- **Index secondaire** : Permet de requêter des données sur des colonnes non-clé.
- **Index matérialisé** : Une table spécialisée qui stocke des données en fonction d'une colonne ou d'un ensemble de colonnes non-clé.
7. **Allow Filtering** :
- Force Cassandra à scanner toutes les partitions plutôt que celles identifiées par la clé de partition.
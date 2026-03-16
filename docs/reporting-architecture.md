# Reporting Architecture

Reporting is designed as a shared platform capability.

## Reporting Objectives

Provide operational visibility across departments.

Examples:

production totals  
machine utilization  
quality performance  
maintenance metrics  

## Reporting Sources

Reports may use data from multiple modules.

Examples

Production  
QC  
Maintenance  
Warehouse  

## Data Sources

Primary operational data is stored in PostgreSQL.

Attachment files stored in Amazon S3 may also be referenced in reports when needed.

Future ERP connection.

Future Wilcom E3 connection.

## Future Reporting Platform

Potential tools:

Metabase  
Internal reporting dashboards  

## Reporting Data Model

Reports should use shared KPI definitions and consistent date logic.

Examples

shift date  
production totals  
downtime  
scrap percentage  
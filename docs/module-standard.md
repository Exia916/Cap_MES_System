# Module Development Standard

All modules in the Cap Operations Platform should follow a consistent structure.

## Standard Module Components

Each module typically includes:

List Page  
Displays records using the shared DataTable component.

View Page  
Displays record details and activity.

Edit Page  
Allows updates to records.

API Routes  
Handles backend logic.

Repository  
Handles database interaction.

## Typical Module Structure

app/modules/moduleName

pages  
api  
repositories  
components  

## Shared Record Layout

Most record view pages follow the standard layout:

Left Side

Record details

Right Sidebar

Attachments  
Comments  
Activity History  

Attachments are stored in Amazon S3 and referenced by the platform database.

## DataTable Standard

List pages must use the shared DataTable component.

Features include:

- filtering
- sorting
- pagination
- action buttons
- export support
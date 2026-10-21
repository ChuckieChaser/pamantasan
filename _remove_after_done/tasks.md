### TWEAKS AND BUGS

just a few tweak, make the share tab data list be able to collapse so that you can view them without having to scroll way way longer

---

single publish / single reshare should not deselect the file

---

clicking the republish and revoking the last user access through there for some reason changed it to entire department for some reason, changing the view for select few to all and i have to revoke it again to actually revoke the access.

---

the global search and notification on the top bar clips on the filter section of the table/list/grid container of the page for some reason

---

administrator cannot edit other administrators

add a guard that disallow similar university id on the user form modal

### CORE CHANGES

the folder that is shared is now the root / holder of the true share property rather than individuals, e.g. if a folder is shared, the files in that folder follow the folder's share property. Editting the share property of the files inside the root shared folder leads to the root folder. As long as they are inside that root folder, they follow that shared property regardless

e.g.

root folder

> file-a
> folder-1
>
> > file-b

root folder have the main share property of the file a, file b and folder 1, clicking their share property leads to the root folder share property

---

uploading a file to a shared folder, makes that new file inherit the share property as the root

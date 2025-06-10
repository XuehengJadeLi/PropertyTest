CREATE DATABASE rotterdam_property_data;

\c rotterdam_property_data;

CREATE TABLE woz_objects (
    id SERIAL PRIMARY KEY,
    wozobjectnr VARCHAR(20) NOT NULL,
    straat VARCHAR(100),
    hnr VARCHAR(20),
    hltr VARCHAR(10),
    pstc VARCHAR(10),
    pandid VARCHAR(20) NOT NULL,
    vboid VARCHAR(20),
    numid VARCHAR(20),
    bwjr INTEGER,
    bag_gebruiksdoel VARCHAR(50),
    woz_gebruikscode VARCHAR(10),
    woz_gebruikscode_oms VARCHAR(100),
    bwlg_vb0 INTEGER,
    laagste_bwlg_pnd INTEGER,
    hoogste_bwlg_pnd INTEGER,
    aant_bwlg_pnd INTEGER
);

CREATE INDEX idx_pandid ON woz_objects(pandid); 
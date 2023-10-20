db.tb_mdemo1.insert({
    tb_col1: "String from script",
    tb_col2: 789,
    tb_col3: false,
    tb_col4: new Date(),
    tb_col5: { subfield1: "subdata from script", subfield2: 101112 },
    tb_col6: [6, 7, 8, 9, 10]
});

db.tb_mdemo1.insertMany([
    {
        tb_col1: "String 1 from script",
        tb_col2: 123,
        tb_col3: true,
        tb_col4: new Date(),
        tb_col5: { subfield1: "subdata 1 from script", subfield2: 456 },
        tb_col6: [1, 2, 3, 4, 5]
    },
    {
        tb_col1: "String 2 from script",
        tb_col2: 789,
        tb_col3: false,
        tb_col4: new Date(),
        tb_col5: { subfield1: "subdata 2 from script", subfield2: 101112 },
        tb_col6: [6, 7, 8, 9, 10]
    }
]);
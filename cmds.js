const {models} = require('./model');
const {log, biglog, errorlog, colorize} = require('./out');
//const process = require('process');
const Sequelize = require('sequelize');

exports.helpCmd = rl => {
    log("Commandos:");
    log("  h|help - Muestra esta ayuda.");
    log("  list - Listar los quizzes existentes.");
    log("  show <id> - Muestra la pregunta y la respuesta en el quiz indicado.");
    log("  add - Añadir un nuevo quiz interactivamente.");
    log("  delete <id> - Borrar el quiz indicado.");
    log("  edit <id> - Editar el quiz indicado.");
    log("  test <id> - Probar el quiz indicado.");
    log("  p|player - Jugar a preguntar aleatoriamente todos los quizzes.");
    log("  credits - Créditos.");
    log("  q|quit - Salir del programa.");
    rl.prompt();
};

exports.listCmd = rl => {

    models.quiz.findAll()
    .each(quiz => {
      log(`  [${colorize(quiz.id, 'magenta')}]: ${quiz.question}`);
    })
    .catch(error => {
      errorlog(error.message);
    })
    .then(() => {
      rl.prompt();
    });
};

const validateId = id =>{
  return new Sequelize.Promise((resolve, reject) => {
    if(typeof id === "undefined") {
      reject(new Error(`Falta el parámetro <id>.`));
    } else {
      id = parseInt(id);
      if (Number.isNaN(id)) {
        reject(new Error(`El valor del parámetro <id> no es un número.`));
      } else {
        resolve(id);
      }
    }
  });
};

exports.showCmd = (rl, id) => {
  validateId(id)
  .then(id => models.quiz.findById(id))
  .then(quiz => {
    if(!quiz) {
      throw new Error(`No existe el quiz asociado al id=${id}.`);
    }
    log(`   [${colorize(quiz.id, 'magenta')}]: ${quiz.question} ${colorize("=>", 'magenta')} ${quiz.answer}`);
  })
  .catch(error => {
      errorlog(error.message);
    })
    .then(() => {
      rl.prompt();
    });
};

const makeQuestion = (rl, text) => {
  return new Sequelize.Promise((resolve, reject) => {
    rl.question(colorize(text, 'red'), answer => {
      resolve(answer.trim());
    });
  });
};

exports.addCmd = rl => {
  
  makeQuestion(rl, ' Introduzca una pregunta: ')
  .then(q => {
    return makeQuestion(rl, ' Introduzca la respuesta ')
    .then(a => {
      return {question: q, answer: a};
    });
  })
  .then(quiz => {
    return models.quiz.create(quiz);
  })
  .then((quiz) => {
    log(`   [${colorize('Se ha añadido', 'magenta')}]: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
  })
  .catch(Sequelize.ValidationError, error => {
    errorlog('El quiz es erróneo:');
    error.errors.forEach(({message}) => errorlog(message));
  })
  .catch(error => {
      errorlog(error.message);
  })
  .then(() => {
      rl.prompt();
  });
};

exports.deleteCmd = (rl,id) => {
	validateId(id)
	.then(id => models.quiz.destroy({where: {id}}))
	.catch(error => {
		errorlog(error.message);
	})
	.then(() => {
		rl.prompt();
	});
};

exports.editCmd = (rl, id) => {
  
  validateId(id)
  .then(id => models.quiz.findById(id))
  .then(quiz => {
    if (!quiz) {
      throw new Error(`No existe un quiz asociado al id=${id}.`);
    }
    process.stdout.isTTY && setTimeout(() => {rl.write(quiz.question)}, 0);
    return makeQuestion(rl, ' Introduzca la pregunta: ')
    .then(q => {
      process.stdout.isTTY && setTimeout(() => {rl.write(quiz.answer)}, 0);
      return makeQuestion(rl, ' Introduzca la respuesta ')
      .then(a => {
        quiz.question = q;
        quiz.answer = a;
        return quiz;
      });
    });
  })
  .then(quiz => {
    return quiz.save();
  })
  .then(quiz => {
    log(`Se ha cambiado el quiz ${colorize(quiz.id, 'magenta')} por: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
  })
  .catch(Sequelize.ValidationError, error => {
    errorlog('El quiz es erróneo:');
    error.errors.forEach(({message}) => errorlog(message));
  })
  .catch(error => {
    errorlog(error.message);
  })
  .then(() => {
    rl.prompt();
  });
  
};

exports.testCmd = (rl, id) => {
  validateId(id)
	.then(id => models.quiz.findById(id))
	.then(quiz => {
		if (!quiz) {
			throw new Error(`No existe un quiz asociado al id=${id}.`);
		}
		
		log(` [${colorize(quiz.id, 'magenta')}]: ${quiz.question}`);
		return makeQuestion(rl, ' Introduzca la respuesta ')
		.then(a => {
			switch(a.toLowerCase().trim()){
          case quiz.answer.toLowerCase().trim():
              log('Su respuesta es correcta.');
        biglog('CORRECTO','green');
              break;
          default:
              log('Su respuesta es incorrecta.');
              biglog('INCORRECTO','red');
              break;
      }
	});
	})
	.catch(error => {
		errorlog(error.message);
	})
	.then(() => {
		rl.prompt();
	});
};

exports.playCmd = rl => {
    
  let score = 0;
	let toBeResolved = [];
	
	const playOne = () => {
		return new Sequelize.Promise((resolve,reject) => {
			
			if(toBeResolved.length === 0){
				console.log("No hay nada más que preguntar.\nFin del quiz. Aciertos: ");
				resolve();
				return;
			} else {
			    let id = Math.floor(Math.random()*toBeResolved.length);
			    let quiz = toBeResolved[id];
			    toBeResolved.splice(id,1);
			
			    return makeQuestion(rl, quiz.question+'? ')
			    .then(a => {
				      switch(a.toLowerCase().trim()){
                case quiz.answer.toLowerCase().trim():
                    score++;
                    console.log('CORRECTO.\nLleva ',score, 'aciertos');
                    resolve(playOne());
                    break;
                default:
                    console.log("INCORRECTO.\nFin del juego. Aciertos: ");
                    resolve();
                    break;
            }
			    });
			}
		});
	};
	
	models.quiz.findAll({raw: true})
	.then(quizzes => {
		toBeResolved = quizzes;
	})
	.then(() => {
		return playOne();
	})
	.catch(error => {
		console.log(error);
	})
	.then(() => {
		biglog(`${score}`,'magenta');
		rl.prompt();
	});
};

exports.creditsCmd = rl => {
    log('Autoras de la práctica:');
    log('Adriana García Rivero', 'green');
    log('Andrea García Fernandez', 'green');
    rl.prompt();
};

exports.quitCmd = rl => {
    rl.close();
};